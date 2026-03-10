'use strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';

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
    } catch (error) {
         console.error(`Error fetching user name for ${userId} from 'clients':`, error);
    }
    console.log(`getUserName: Could not find a name for userId: ${userId} in 'clients' collection.`);
    return null;
};

async function isUserCoach(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
        const clientSnap = await db.collection('clients').doc(userId).get();
        return clientSnap.exists && clientSnap.data()?.role === 'coach';
    } catch (error) {
        console.error(`Error checking if user ${userId} is a coach:`, error);
        return false;
    }
}

// This is the single function that required the definitive fix.
async function sendPushNotification(userId: string, title: string, message: string, ctaUrl: string, notificationType: string, entityId: string, imageUrl?: string, senderId?: string, senderName?: string, messageText?: string) {
    const userDocRef = db.collection('clients').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
        console.log(`sendPushNotification: User profile ${userId} not found in 'clients' collection.`);
        return;
    }

    const tokens = userDoc.data()?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) {
        console.log(`sendPushNotification: User ${userId} has no valid FCM tokens.`);
        return;
    }

    const channelId = notificationType === 'chat' ? 'chat_messages' : 'reminders';

    // DEFINITIVE FIX: The data payload is now built with the specific keys the frontend expects.
    const dataPayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
        url: String(ctaUrl), // Used by service worker for PWA clicks
        notificationType: String(notificationType),
        entityId: String(entityId),
        senderId: String(senderId || ''),
        senderName: String(senderName || ''),
        messageText: String(messageText || ''),
        ...(imageUrl && { imageUrl: String(imageUrl) }),
        isCoach: String(await isUserCoach(userId))
    };

    // This logic adds the specific keys needed by the PushNotificationProvider's handleNotificationAction function.
    if (notificationType === 'chat') {
        dataPayload.chatId = entityId;
    } else if (notificationType === 'workout_reminder') {
        dataPayload.workoutId = entityId;
    } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType)) {
        dataPayload.appointmentId = entityId;
    } else if (notificationType === 'hydration') {
        // This was the missing piece for hydration on native/in-app.
        dataPayload.hydration = 'true';
    }

    const payload: MulticastMessage = {
        tokens: tokens,
        notification: {
            title: String(title),
            body: String(message),
            imageUrl: imageUrl,
        },
        data: dataPayload,
        apns: {
            payload: {
                aps: {
                    alert: { title: String(title), body: String(message) },
                    badge: 1,
                    sound: 'default',
                    'mutable-content': 1,
                },
            },
            fcmOptions: {
                imageUrl: imageUrl,
            },
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: String(title),
                body: String(message),
                channelId: String(channelId),
                imageUrl: imageUrl,
                sound: 'default',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
        },
    };

    let response: BatchResponse;
    try {
        response = await messaging.sendEachForMulticast(payload as any);
        console.log(`FCM Response for ${userId}. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp: { success: boolean, error?: { code: string } }, idx: number) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    console.error(`  - Failure for token ${tokens[idx]}: ${errorCode}`);
                    if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(tokens[idx]);
                    }
                }
            });

            if (tokensToRemove.length > 0) {
                const currentTokens = userDoc.data()?.fcmTokens || [];
                const updatedTokens = currentTokens.filter((token: string) => !tokensToRemove.includes(token));
                await userDocRef.update({ fcmTokens: updatedTokens });
                console.log(`Removed ${tokensToRemove.length} invalid tokens for user ${userId}.`);
            }
        }
    } catch (error) {
        console.error(`Catastrophic error sending notification to user ${userId}:`, error);
    }
}

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) { return; }
    const message = event.data.data();
    if (!message || message.userId === 'system') { return; }

    const chatId = event.params.chatId;
    const senderId = message.userId;
    const messageText = message.text || (message.fileUrl ? 'You received a new attachment' : '[Empty Message]');
    const imageUrl = message.fileUrl || null;

    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) { return; }

    const chatData = chatDoc.data()!;
    const participants = chatData.participants || [];
    const recipients = participants.filter((p: string) => p !== senderId && !(chatData.mutedBy && chatData.mutedBy.includes(p)));

    if (recipients.length === 0) { return; }

    const senderName = await getUserName(senderId);
    const body = messageText.substring(0, 100);
    let title = senderName ? `New message from ${senderName}` : 'New Message';

    if (chatData.type === 'private_group' || chatData.type === 'open') {
        title = chatData.name ? `New message in ${chatData.name}` : 'New Group Message';
    }

    const promises = recipients.map(async (recipientId: string) => {
        const isRecipientCoach = await isUserCoach(recipientId);
        const dashboardUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';
        const ctaUrl = `${dashboardUrl}?openChatId=${String(chatId)}&notificationType=chat&isCoach=${String(isRecipientCoach)}`;

        return sendPushNotification(recipientId, title, body, ctaUrl, 'chat', String(chatId), imageUrl || undefined, senderId, senderName || '', body);
    });

    await Promise.all(promises);
});

export const testPushNotification = onRequest(async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
        res.status(400).send("Please provide a userId");
        return;
    }
    try {
        await sendPushNotification(userId, 'Test Notification', 'This is a test message.', '/client/dashboard?notificationType=test', 'test', 'test-id');
        res.send(`Successfully triggered a test notification for user ${userId}.`);
    } catch (error) {
        res.status(500).send(`Failed to send notification.`);
    }
});

export const workoutReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, workoutId, workoutName } = req.data;
    const docRef = db.collection('scheduledWorkouts').doc(workoutId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.status === 'reminder_sent') { return; }

    const isRecipientCoach = await isUserCoach(userId);
    // DEFINITIVE FIX: The URL now uses the specific key the frontend expects.
    const ctaUrl = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${String(workoutId)}&isCoach=${String(isRecipientCoach)}`;
    
    await sendPushNotification(userId, 'Workout Reminder', `Your scheduled workout, "${workoutName}," is in 10 minutes!`, ctaUrl, 'workout_reminder', String(workoutId));
    await docRef.update({ status: 'reminder_sent' });
});

export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    if (!event.data) { return; }
    const workout = event.data.data();
    const workoutId = event.params.workoutId;
    if (!workout || !event.data.createTime || workout.status !== 'scheduled') { return; }

    const { userId, workoutName, scheduledDate } = workout;
    const reminderTime = new Date(scheduledDate.toMillis() - 10 * 60 * 1000);
    if (reminderTime < new Date()) { return; }

    const queue = getFunctions().taskQueue('workoutReminderHandler');
    try {
        await queue.enqueue({ userId, workoutId, workoutName }, { scheduleTime: reminderTime });
    } catch (error) {
        console.error(`Error enqueuing task for workout ${workoutId}:`, error);
    }
});

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, appointmentId, isCoach, opponentName, eventTitle } = req.data;
    let title = 'Upcoming Appointment';
    let message = `Your appointment with ${opponentName || 'your coach/client'} is in 10 minutes.`;
    if (eventTitle) {
        title = 'Live Event Starting Soon';
        message = `The event "${eventTitle}" is starting in 10 minutes!`;
    }
    const dashboardUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';
    // DEFINITIVE FIX: The URL now uses the specific key the frontend expects.
    const ctaUrl = `${dashboardUrl}?notificationType=appointment_reminder&openAppointmentId=${appointmentId}&isCoach=${String(isCoach)}`;

    await sendPushNotification(userId, title, message, ctaUrl, 'appointment_reminder', appointmentId);
});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) { return; }
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !event.data.createTime || !appointment.start) { return; }

    const reminderTime = new Date(appointment.start.toMillis() - 10 * 60 * 1000);
    if (reminderTime < new Date()) { return; }

    const queue = getFunctions().taskQueue('appointmentReminderHandler');
    if (appointment.type === 'one_on_one') {
        const { clientId, coachId } = appointment;
        const clientName = await getUserName(clientId);
        const coachName = await getUserName(coachId);
        const tasks: Promise<any>[] = [];
        if (clientId) {
            tasks.push(queue.enqueue({ userId: clientId, appointmentId, isCoach: false, opponentName: coachName || 'your coach' }, { scheduleTime: reminderTime }));
        }
        if (coachId) {
            tasks.push(queue.enqueue({ userId: coachId, appointmentId, isCoach: true, opponentName: clientName || 'your client' }, { scheduleTime: reminderTime }));
        }
        await Promise.all(tasks);
    } else if (appointment.liveEventId) {
        const liveEventDoc = await db.collection('live-events').doc(appointment.liveEventId).get();
        if (!liveEventDoc.exists) return;
        const liveEvent = liveEventDoc.data()!;
        const attendees = liveEvent.attendees || [];
        if (attendees.length === 0) return;
        const eventTitle = liveEvent.title || 'your live event';
        const attendeeTasks = attendees.map((attendeeId: string) => {
            return queue.enqueue({ userId: attendeeId, appointmentId, isCoach: false, eventTitle }, { scheduleTime: reminderTime });
        });
        await Promise.all(attendeeTasks);
    }
});

export const hydrationReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, reminderId } = req.data;
    const docRef = db.collection('reminders').doc(reminderId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.status !== 'scheduled') { return; }

    const reminder = doc.data()!;
    const scheduledTime = reminder.scheduledAt.toDate();
    const timeString = scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const message = `This is your ${timeString} hydration reminder.`;
    
    // DEFINITIVE FIX: The URL is correct for PWA, and the data payload fix in sendPushNotification will fix it for native.
    const ctaUrl = '/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false';
    const iconUrl = 'https://storage.googleapis.com/hunger-free-and-happy-app.appspot.com/app-assets/water-drop-icon.png';

    await sendPushNotification(userId, '💧 Time to Hydrate!', message, ctaUrl, 'hydration', 'hydration', iconUrl);
    await docRef.update({ status: 'sent' });
});

export const onReminderScheduled = onDocumentCreated("reminders/{reminderId}", async (event) => {
    if (!event.data) { return; }
    const reminder = event.data.data();
    const { reminderId } = event.params;
    if (!reminder || reminder.type !== 'hydration_reminder' || reminder.status !== 'scheduled' || !event.data.createTime) { return; }

    const { userId, scheduledAt } = reminder;
    const reminderTime = scheduledAt.toDate();

    if (reminderTime < new Date()) { return; }

    const queue = getFunctions().taskQueue('hydrationReminderHandler');
    try {
        await queue.enqueue({ userId, reminderId }, { scheduleTime: reminderTime });
    } catch (error) {
        console.error(`onReminderScheduled: Error enqueuing task for reminder ${reminderId}:`, error);
    }
});
