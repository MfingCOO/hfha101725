'use strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Standardized Name Fetcher from 'clients' collection
const getUserName = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
        const clientDoc = await db.collection('clients').doc(userId).get();
        return clientDoc.exists ? (clientDoc.data()?.fullName as string) : null;
    } catch (error) {
        console.error(`Error fetching user name for ${userId}:`, error);
        return null;
    }
};

// Universal Push Sender - Standardizes IDs so the PWA Pop-ups trigger correctly
async function sendPushNotification(
    userId: string, 
    title: string, 
    message: string, 
    ctaUrl: string, 
    notificationType: string, 
    entityId: string, 
    imageUrl?: string
) {
    const userDoc = await db.collection('clients').doc(userId).get();
    if (!userDoc.exists) {
        console.log(`Notification aborted: User ${userId} not found in 'clients'.`);
        return;
    }

    const userData = userDoc.data();
    const tokens = userData?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) return;

    const isCoach = userData?.role === 'coach';
    const channelId = notificationType === 'chat' ? 'chat_messages' : 'reminders';

    // payload.data MUST contain these keys for the PWA PushNotificationProvider.tsx to trigger modals
    const dataPayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
        notificationType: String(notificationType),
        entityId: String(entityId),
        chatId: notificationType === 'chat' ? entityId : '',
        workoutId: notificationType === 'workout_reminder' ? entityId : '',
        appointmentId: ['appointment_reminder', 'appointment_booked'].includes(notificationType) ? entityId : '',
        hydration: notificationType === 'hydration' ? 'true' : 'false',
        isCoach: String(isCoach),
        link: String(ctaUrl)
    };

    const payload: MulticastMessage = {
        tokens: tokens,
        notification: { 
            title: String(title), 
            body: String(message), 
            imageUrl: imageUrl || undefined 
        },
        data: dataPayload,
        android: {
            priority: 'high',
            notification: {
                channelId: channelId,
                sound: 'default',
                imageUrl: imageUrl || undefined
            }
        },
        apns: {
            payload: {
                aps: { 
                    alert: { title: String(title), body: String(message) }, 
                    sound: 'default', 
                    badge: 1 
                }
            }
        }
    };

    try {
        await messaging.sendEachForMulticast(payload);
        console.log(`Successfully sent ${notificationType} to ${userId}`);
    } catch (error) {
        console.error(`FCM Multi-send error for ${userId}:`, error);
    }
}

// --- TRIGGERS ---

// 1. Chat Messages
export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message || message.userId === 'system') return;

    const chatId = event.params.chatId;
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) return;

    const chatData = chatDoc.data()!;
    const recipients = (chatData.participants || []).filter((p: string) => p !== message.userId);
    
    const senderName = await getUserName(message.userId);
    const title = senderName ? `New message from ${senderName}` : 'New Message';

    for (const recipientId of recipients) {
        const recipientDoc = await db.collection('clients').doc(recipientId).get();
        const isCoach = recipientDoc.data()?.role === 'coach';
        const dashboard = isCoach ? '/coach' : '/client';
        const url = `${dashboard}/dashboard?openChatId=${chatId}`;
        
        await sendPushNotification(recipientId, title, message.text, url, 'chat', chatId);
    }
});

// 2. Appointment Reminders (The Task Handler)
export const appointmentReminderHandler = onTaskDispatched({ retryConfig: { maxAttempts: 3 } }, async (req) => {
    const { userId, appointmentId, isCoach, opponentName } = req.data;
    const dashboard = isCoach ? '/coach' : '/client';
    const url = `${dashboard}/dashboard?notificationType=appointment_reminder&openAppointmentId=${appointmentId}`;
    
    await sendPushNotification(userId, 'Upcoming Session', `Meeting with ${opponentName} in 10m`, url, 'appointment_reminder', appointmentId);
});

// 3. Appointment Scheduled (The Creator)
export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    const appt = event.data?.data();
    if (!appt || !appt.start) return;

    const appointmentId = event.params.appointmentId;
    const reminderTime = new Date(appt.start.toMillis() - 10 * 60 * 1000);
    const queue = getFunctions().taskQueue('appointmentReminderHandler');

    if (appt.clientId) {
        await queue.enqueue({ userId: appt.clientId, appointmentId, isCoach: false, opponentName: 'your coach' }, { scheduleTime: reminderTime });
    }
    if (appt.coachId) {
        await queue.enqueue({ userId: appt.coachId, appointmentId, isCoach: true, opponentName: 'your client' }, { scheduleTime: reminderTime });
    }
});

// 4. Workout Reminders (The Task Handler)
export const workoutReminderHandler = onTaskDispatched({ retryConfig: { maxAttempts: 3 } }, async (req) => {
    const { userId, workoutId, workoutName } = req.data;
    const url = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${workoutId}`;
    
    await sendPushNotification(userId, 'Workout Reminder', `"${workoutName}" starts in 10m`, url, 'workout_reminder', workoutId);
    await db.collection('scheduledWorkouts').doc(workoutId).update({ status: 'reminder_sent' });
});

// 5. Workout Scheduled (The Creator)
export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    const workout = event.data?.data();
    if (!workout || workout.status !== 'scheduled' || !workout.scheduledDate) return;

    const workoutId = event.params.workoutId;
    const reminderTime = new Date(workout.scheduledDate.toMillis() - 10 * 60 * 1000);
    const queue = getFunctions().taskQueue('workoutReminderHandler');

    await queue.enqueue({ 
        userId: workout.userId, 
        workoutId, 
        workoutName: workout.workoutName 
    }, { scheduleTime: reminderTime });
});

// 6. Hydration Reminders (The Task Handler)
export const hydrationReminderHandler = onTaskDispatched({ retryConfig: { maxAttempts: 3 } }, async (req) => {
    const { userId, reminderId } = req.data;
    const url = '/client/dashboard?openHydration=true&notificationType=hydration';
    
    await sendPushNotification(userId, '💧 Hydration', 'Time to log your water intake!', url, 'hydration', 'hydration');
    await db.collection('reminders').doc(reminderId).update({ status: 'sent' });
});

// 7. Hydration Scheduled (The Creator)
export const onReminderScheduled = onDocumentCreated("reminders/{reminderId}", async (event) => {
    const rem = event.data?.data();
    if (!rem || rem.status !== 'scheduled' || !rem.scheduledAt) return;

    const queue = getFunctions().taskQueue('hydrationReminderHandler');
    await queue.enqueue({ 
        userId: rem.userId, 
        reminderId: event.params.reminderId 
    }, { scheduleTime: rem.scheduledAt.toDate() });
});