import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// -----------------------------------------------------------------------------
// PART A: INFORMATIVE NOTIFICATION TRIGGERS
// -----------------------------------------------------------------------------

const getUserName = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
        const doc = await db.collection('clients').doc(userId).get();
        if (doc.exists && doc.data()?.fullName) {
            console.log(`getUserName: Found name for ${userId} in 'clients'.`);
            return doc.data()?.fullName as string;
        }
    } catch (error) {
         console.error(`Error searching for user ${userId} in 'clients':`, error);
    }
    console.log(`getUserName: Could not find a name for userId: ${userId} in the 'clients' collection.`);
    return null;
};

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log("onNewMessage: No message data found. Exiting.");
        return;
    }

    const chatId = event.params.chatId;
    const senderId = message.userId;
    const messageText = message.text || 'You received a new message';

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

    console.log(`onNewMessage: Notification details - Title: '${title}', Body: '${body}', EntityID: '${chatId}'`);

    const promises = recipients.map((recipientId: string) => {
        const notificationData = {
            userId: recipientId,
            title: title,
            message: body,
            ctaUrl: `/client/dashboard?notificationType=chat&entityId=${chatId}`,
            notificationType: 'chat',
            entityId: chatId, 
            sendTime: Timestamp.now(),
            processed: false,
        };
        console.log(`onNewMessage: Creating notification document for recipient: ${recipientId}`);
        return db.collection('notifications').add(notificationData);
    });

    await Promise.all(promises);
    console.log(`onNewMessage: Successfully created ${recipients.length} notification documents for chat ${chatId}.`);
});

export const hydrationReminderEngine = onSchedule('every 15 minutes', async (event) => {
    const now = Timestamp.now();
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
                sendTime: now,
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

        const notificationPromises = [clientId, coachId].map(userId => {
            if (!userId) return Promise.resolve();

            const isCoach = userId === coachId;
            const title = 'Upcoming Appointment';
            const message = `Your appointment with ${isCoach ? clientName : 'your coach'} is in 10 minutes.`;

            const notificationData = {
                userId: userId,
                title: title,
                message: message,
                ctaUrl: `/client/dashboard?notificationType=appointment_reminder&entityId=${appointmentId}`,
                notificationType: 'appointment_reminder',
                entityId: appointmentId,
                sendTime: Timestamp.now(),
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
            ctaUrl: `/client/dashboard?notificationType=workout_reminder&entityId=${workoutId}`,
            notificationType: 'workout_reminder',
            entityId: workoutId,
            sendTime: Timestamp.now(),
            processed: false,
        };

        console.log(`Creating workout reminder for ${userId} for workout ${workoutId}`);
        await db.collection('notifications').add(notificationData);
        return doc.ref.update({ status: 'reminder_sent' });
    });

    await Promise.all(promises);
});

// -----------------------------------------------------------------------------
// PART B: THE ENGINE (SENDS ALL PUSH NOTIFICATIONS)
// -----------------------------------------------------------------------------

async function sendPushNotification(userId: string, title: string, message: string, ctaUrl?: string, notificationType?: string, entityId?: string, sentTime?: Timestamp) {
    const userDoc = await db.collection('clients').doc(userId).get();
    if (!userDoc.exists) {
        console.log(`sendPushNotification: User profile ${userId} not found in 'clients'.`);
        return;
    }

    const userData = userDoc.data();
    if (!userData) {
        console.log(`sendPushNotification: User data is empty for user ${userId}.`);
        return;
    }

    if (!userData.fcmTokens || userData.fcmTokens.length === 0) {
        console.log(`sendPushNotification: User ${userId} has no FCM tokens.`);
        return;
    }

    const tokens = userData.fcmTokens.filter((t: string) => t);
    if (tokens.length === 0) {
        console.log(`sendPushNotification: No valid FCM tokens for user ${userId}.`);
        return;
    }

    // --- THE FIX: START ---
    // Create a base payload and ensure every value is a string.
    const basePayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
        ctaUrl: String(ctaUrl || '/'),
        notificationType: String(notificationType || 'general'),
        sent_time: String(sentTime?.toMillis() || Date.now()),
    };

    const type = notificationType || 'general';
    const id = entityId || 'none';

    switch (type) {
        case 'chat':
            basePayload['chatId'] = String(id);
            break;
        case 'workout':
        case 'workout_reminder':
            basePayload['workoutId'] = String(id);
            break;
        case 'appointment_reminder':
        case 'appointment_booked':
            basePayload['appointmentId'] = String(id);
            break;
        default:
            basePayload['entityId'] = String(id);
            break;
    }
    // --- THE FIX: END ---

    const payload = {
        tokens: tokens,
        data: basePayload,
        notification: { title, body: message },
        webpush: { fcmOptions: { link: ctaUrl || '/' }, notification: { icon: '/icon.png', data: basePayload } },
        android: { 
            priority: 'high' as const, 
            notification: { 
                title, 
                body: message, 
                channelId: 'chat_messages', 
                icon: 'ic_stat_notification',
            }
        },
        apns: {
            payload: { aps: { alert: { title, body: message }, 'content-available': 1, sound: 'default', badge: 1, category: 'HUNGREE_NOTIFICATION_ACTIONS' }, ...basePayload },
            headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
        },
    };

    try {
        await messaging.sendEachForMulticast(payload as any);
        console.log(`sendPushNotification: Successfully sent notification to user ${userId} for type '${notificationType}'.`);
    } catch (error) {
        console.error(`sendPushNotification: Error sending push notification to user ${userId}:`, error);
    }
}

export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  const now = Timestamp.now();
  const query = db.collection('notifications').where('processed', '==', false).where('sendTime', '<=', now);
  const snapshot = await query.get();
  if (snapshot.empty) {
    return;
  }
  console.log(`unifiedNotificationEngine: Found ${snapshot.docs.length} notifications to process.`);
  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    await doc.ref.update({ processed: true });
    console.log(`unifiedNotificationEngine: Processing notification ${doc.id} for user ${notification.userId}`);
    await sendPushNotification(notification.userId, notification.title, notification.message, notification.ctaUrl, notification.notificationType, notification.entityId, notification.sendTime);
  });
  await Promise.all(promises);
});

export { saveFcmToken } from './saveFcmToken';
export { removeFcmToken } from './removeFcmToken';