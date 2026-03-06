'use strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const getUserName = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
        const clientDoc = await db.collection('clients').doc(userId).get();
        if (clientDoc.exists && clientDoc.data()?.fullName) {
            return clientDoc.data()?.fullName as string;
        }
        const coachDoc = await db.collection('coaches').doc(userId).get();
        if (coachDoc.exists && coachDoc.data()?.fullName) {
            return coachDoc.data()?.fullName as string;
        }
    } catch (error) {
         console.error(`Error searching for user ${userId}:`, error);
    }
    console.log(`getUserName: Could not find a name for userId: ${userId}.`);
    return null;
};

// This function directly sends the push notification with a stringified data payload
async function sendPushNotification(userId: string, title: string, message: string, ctaUrl: string, notificationType: string, entityId: string, imageUrl?: string, sendTimeStr?: string) {
    let userDoc = await db.collection('clients').doc(userId).get();
    if (!userDoc.exists) {
        console.log(`sendPushNotification: User ${userId} not found in 'clients', trying 'coaches'.`);
        userDoc = await db.collection('coaches').doc(userId).get();
    }

    if (!userDoc.exists) {
        console.log(`sendPushNotification: User profile ${userId} not found in 'clients' or 'coaches'.`);
        return;
    }

    const userData = userDoc.data();
    if (!userData || !userData.fcmTokens || userData.fcmTokens.length === 0) {
        console.log(`sendPushNotification: User ${userId} has no FCM tokens.`);
        return;
    }

    const tokens = userData.fcmTokens.filter((t: string) => t);
    if (tokens.length === 0) {
        console.log(`sendPushNotification: No valid FCM tokens for user ${userId}.`);
        return;
    }

    const url = new URL(ctaUrl || '/', 'https://hunger-free-and-happy.app'); // Use your canonical PWA URL
    const searchParams = url.searchParams;

    const dataPayload: { [key: string]: string } = {
        // Essential data for your app's logic, ALL AS STRINGS
        notificationType: notificationType,
        entityId: entityId, 
        url: ctaUrl || '/', 
        
        // Include properties from the original notification document, ensuring string conversion
        title: title,
        body: message,
        
        // Pass relevant URL query parameters, ensuring they are strings
        // This is crucial for your PWA to open the correct dashboard and popup
        ...(Object.fromEntries(Array.from(searchParams.entries()).map(([key, value]) => [key, String(value)]))),

        // Add imageUrl if it exists, explicitly as a string
        ...(imageUrl && { imageUrl: imageUrl }),

        // Add sendTime as a string
        ...(sendTimeStr && { sendTime: sendTimeStr }),

        // Add other Firebase-specific keys if needed, ensuring string conversion
        'google.sent_time': String(Date.now()), 
        'google.ttl': '3600' 
    };
    
    // Determine if the recipient is a coach for deep-linking in the PWA
    const isRecipientCoach = ctaUrl.includes('/coach/dashboard');
    dataPayload.isCoach = String(isRecipientCoach);


    const payload = { 
        tokens: tokens,
        notification: {
            title: title,
            body: message,
            imageUrl: imageUrl || undefined, 
            sound: 'default' 
        },
        data: dataPayload, 
        apns: {
            payload: {
                aps: {
                    'content-available': 1,
                    sound: 'default',
                    badge: 1,
                }
            }
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'default_channel', 
                imageUrl: imageUrl || undefined, 
            }
        }
    };

    try {
        console.log(`sendPushNotification: Sending corrected payload to user ${userId}:`, JSON.stringify(payload, null, 2));
        await messaging.sendEachForMulticast(payload as any);
        console.log(`sendPushNotification: Successfully sent notification to user ${userId}.`);
    } catch (error) {
        console.error(`sendPushNotification: Error sending push notification to user ${userId}:`, error);
    }
}


export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log("onNewMessage: No message data found. Exiting.");
        return;
    }

    const chatId = event.params.chatId;
    const senderId = message.userId;
    const messageText = message.text || 'You received a new attachment';
    const imageUrl = message.imageUrl || null;
    const now = Timestamp.now(); 

    console.log(`onNewMessage: Processing new message in chat ${chatId} from sender ${senderId}.`);

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
        console.log(`onNewMessage: Chat document ${chatId} not found. Exiting.`);
        return;
    }
    const chatData = chatDoc.data()!;
    const participants = chatData.participants || [];
    const recipients = participants.filter((p: string) => p !== senderId);

    if (recipients.length === 0) {
        console.log("onNewMessage: No recipients to notify. Exiting.");
        return;
    }

    console.log(`onNewMessage: Found ${recipients.length} recipients to notify.`);

    const senderName = await getUserName(senderId);
    const body = messageText.substring(0, 100);
    let title = `New message from ${senderName || 'someone'}`;

    if (chatData.isGroup) {
        title = `New message in ${chatData.name || 'your group chat'}`;
    }

    const promises = recipients.map(async (recipientId: string) => {
        const isRecipientCoach = recipientId === chatData.coachUid;
        // CORRECTED: Use isRecipientCoach which is in scope
        const dashboardUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard'; 
        const ctaUrl = `${dashboardUrl}?notificationType=chat&entityId=${String(chatId)}`; 

        // Store notification data in Firestore (all values as strings if they will be passed to FCM later)
        const notificationData = {
            userId: recipientId,
            title: title,
            message: body,
            ctaUrl: ctaUrl,
            notificationType: 'chat',
            entityId: String(chatId), 
            imageUrl: imageUrl, 
            sendTime: String(now.toDate().getTime()), 
            processed: false,
        };

        console.log(`Creating notification document for user ${recipientId} for chat ${chatId}`);
        return db.collection('notifications').add(notificationData);
    });

    await Promise.all(promises);
    console.log(`onNewMessage: Successfully created ${recipients.length} notification documents for chat ${chatId}.`);
});

export const hydrationReminderEngine = onSchedule('every 15 minutes', async (event) => {
    const now = Timestamp.now();
    const nowMsString = String(now.toDate().getTime());
    const query = db.collection('reminders').where('status', '==', 'scheduled').where('scheduledAt', '<=', now);
    const snapshot = await query.get();
    if (snapshot.empty) {
        return;
    }
    console.log(`Found ${snapshot.docs.length} due hydration reminders.`);
    const promises = snapshot.docs.map(async (doc) => {
        const reminder = doc.data();
        const reminderId = doc.id;
        const userId = reminder.userId;
        try {
            const userRef = db.collection('clients').doc(userId);
            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.log(`User ${userId} not found. Skipping reminder ${reminderId}.`);
                return;
            }
            const userData = userDoc.data();
            if (!userData) {
                console.log(`User data is empty for ${userId}. Skipping reminder ${reminderId}.`);
                return;
            }
            const userTier = userData.tier;
            const ineligibleTiers = ['free', 'ad-free'];
            if (ineligibleTiers.includes(userTier)) {
                console.log(`User ${userId} is on tier '${userTier}' and not eligible for reminders. Skipping.`);
                return;
            }
            const notificationData = {
                userId: userId,
                title: '💧 Time to Hydrate!',
                message: 'A quick reminder to drink some water and log your intake.',
                ctaUrl: `/client/dashboard?notificationType=hydration`,
                notificationType: 'hydration',
                entityId: 'hydration', 
                sendTime: nowMsString, 
                processed: false,
            };
            await db.collection('notifications').add(notificationData);
            console.log(`Created notification document for user ${userId} for reminder ${reminderId}.`);
            if (reminder.recurring) {
                const nextScheduledAt = new Timestamp(reminder.scheduledAt.seconds + (24 * 60 * 60), reminder.scheduledAt.nanoseconds);
                await doc.ref.update({ scheduledAt: nextScheduledAt });
                console.log(`Rescheduled recurring reminder ${reminderId} for user ${userId}.`);
            } else {
                await doc.ref.update({ status: 'completed' });
                console.log(`Marked one-time reminder ${reminderId} as completed for user ${userId}.`);
            }
        } catch (error) {
            console.error(`Error processing reminder ${reminderId} for user ${userId}:`, error);
        }
    });
    await Promise.all(promises);
});

export const appointmentReminderEngine = onSchedule('every 1 minutes', async (event) => {
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

    const tenMinutesFromNowTimestamp = Timestamp.fromDate(tenMinutesFromNow);
    const elevenMinutesFromNowTimestamp = Timestamp.fromDate(elevenMinutesFromNow);
    const nowMsString = String(Timestamp.now().toDate().getTime());

    const query = db.collection('coachCalendar')
        .where('start', '>=', tenMinutesFromNowTimestamp)
        .where('start', '<', elevenMinutesFromNowTimestamp)
        .where('type', '==', 'one_on_one');

    const snapshot = await query.get();

    if (snapshot.empty) {
        return;
    }

    console.log(`Found ${snapshot.docs.length} upcoming appointments for reminders.`);

    const promises = snapshot.docs.map(async (doc) => {
        const appointment = doc.data();
        const appointmentId = doc.id;
        const clientId = appointment.clientId;
        const coachId = appointment.coachId;

        const clientName = await getUserName(clientId);
        const coachName = await getUserName(coachId);

        const notificationPromises = [clientId, coachId].map(userId => {
            if (!userId) return Promise.resolve();

            const isCoach = userId === coachId;
            const title = 'Upcoming Appointment';
            const message = `Your appointment with ${isCoach ? (clientName || 'your client') : (coachName || 'your coach')} is in 10 minutes.`;
            const dashboardUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';
            const ctaUrl = `${dashboardUrl}?notificationType=appointment_reminder&entityId=${String(appointmentId)}`;

            const notificationData = {
                userId: userId,
                title: title,
                message: message,
                ctaUrl: ctaUrl,
                notificationType: 'appointment_reminder',
                entityId: String(appointmentId), 
                sendTime: nowMsString, 
                processed: false,
            };

            console.log(`Creating appointment reminder for ${userId} for appointment ${appointmentId}`);
            return db.collection('notifications').add(notificationData);
        });

        return Promise.all(notificationPromises);
    });

    await Promise.all(promises);
});

export const workoutReminderEngine = onSchedule('every 1 minutes', async (event) => {
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
    const elevenMinutesFromNow = new Date(now.getTime() + 11 * 60 * 1000);

    const tenMinutesFromNowTimestamp = Timestamp.fromDate(tenMinutesFromNow);
    const elevenMinutesFromNowTimestamp = Timestamp.fromDate(elevenMinutesFromNow);
    const nowMsString = String(Timestamp.now().toDate().getTime());

    const query = db.collection('scheduledWorkouts')
        .where('scheduledDate', '>=', tenMinutesFromNowTimestamp)
        .where('scheduledDate', '<', elevenMinutesFromNowTimestamp)
        .where('status', '==', 'scheduled');

    const snapshot = await query.get();

    if (snapshot.empty) {
        return;
    }

    console.log(`Found ${snapshot.docs.length} upcoming workouts for reminders.`);

    const promises = snapshot.docs.map(async (doc) => {
        const workout = doc.data();
        const workoutId = workout.workoutId;
        const userId = workout.userId;
        const workoutName = workout.workoutName || 'your workout';

        const notificationData = {
            userId: userId,
            title: 'Workout Reminder',
            message: `Your scheduled workout, "${workoutName}," is in 10 minutes!`,
            ctaUrl: `/client/dashboard?notificationType=workout_reminder&entityId=${String(workoutId)}`, 
            notificationType: 'workout_reminder',
            entityId: String(workoutId), 
            sendTime: nowMsString, 
            processed: false,
        };

        console.log(`Creating workout reminder for ${userId} for workout ${workoutId}`);
        await db.collection('notifications').add(notificationData);
        return doc.ref.update({ status: 'reminder_sent' });
    });

    await Promise.all(promises);
});

export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  const now = Timestamp.now();
  const nowMsString = String(now.toDate().getTime());
  // Query against string representation of sendTime for consistency
  const query = db.collection('notifications').where('processed', '==', false).where('sendTime', '<=', nowMsString); 
  const snapshot = await query.get();
  if (snapshot.empty) {
    return;
  }
  console.log(`unifiedNotificationEngine: Found ${snapshot.docs.length} notifications to process.`);
  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    await doc.ref.update({ processed: true });
    console.log(`unifiedNotificationEngine: Processing notification ${doc.id} for user ${notification.userId}`);
    // Pass sendTime as a string as it's stored that way, and imageUrl
    await sendPushNotification(
      notification.userId, 
      notification.title, 
      notification.message, 
      notification.ctaUrl, 
      notification.notificationType as string, 
      notification.entityId as string,       
      notification.imageUrl as string | undefined, 
      notification.sendTime as string | undefined
    );
  });
  await Promise.all(promises);
});

export { saveFcmToken } from './saveFcmToken';
export { removeFcmToken } from './removeFcmToken';
