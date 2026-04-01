'use strict';

import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';
import { admin } from '../lib/firebaseAdmin';

const db = getFirestore(admin.app());
const messaging = getMessaging(admin.app());

const debugLog = (msg: string, data?: any) => {
    console.log(`[DEBUG] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
};

const getUserName = async (userId: string): Promise<string> => {
    if (!userId) return 'Unknown User';
    try {
        const clientDoc = await db.collection('clients').doc(userId).get();
        return clientDoc.exists && clientDoc.data()?.fullName ? (clientDoc.data()!.fullName as string) : 'Unknown User';
    } catch (e) {
        debugLog(`getUserName failed for ${userId}`, e);
        return 'Unknown User';
    }
};

/**
 * Core Helper: Sends push notifications to all registered tokens for a user.
 * Maps notification types to Android Channels for banner support.
 */
export async function sendPushNotification(
    userId: string, 
    title: string, 
    message: string, 
    ctaUrl: string, 
    notificationType: string, 
    entityId: string, 
    imageUrl?: string, 
    senderId?: string, 
    senderName?: string, 
    messageText?: string, 
    appointmentStartTimeMillis?: number, 
    isCoachParam?: string
) {
    debugLog(`sendPushNotification START - Type: ${notificationType} | User: ${userId}`);

    const userDocRef = await db.collection('clients').doc(userId).get();
    if (!userDocRef.exists) { debugLog(`User ${userId} not found`); return; }

    const tokens = userDocRef.data()?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) { debugLog(`No tokens for user ${userId}`); return; }

    const defaultImageUrl = 'https://firebasestorage.googleapis.com/v0/b/hunger-free-and-happy-app.appspot.com/o/app-assets%2Flogo_icon_transparent_background.png?alt=media&token=4e3b1234-5678-4321-abcd-1234567890ab';
    const finalImageUrl = imageUrl || defaultImageUrl;

    const truncatedTitle = String(title).substring(0, 50);
    const truncatedMessage = String(message).substring(0, 160);

    // Channel IDs must match the ones created in PushNotificationProvider.tsx
    let channelId = 'default';
    if (notificationType === 'chat') channelId = 'chat_messages';
    else if (notificationType === 'appointment_booked') channelId = 'appointment_booked_notifications';
    else if (notificationType === 'appointment_reminder') channelId = 'appointment_reminders';
    else if (notificationType === 'workout_reminder') channelId = 'workout_reminders';
    else if (notificationType === 'hydration') channelId = 'hydration_reminders';
    else if (notificationType === 'custom-popup') channelId = 'custom_popups';
    else if (notificationType.includes('indulgence_')) channelId = 'indulgence_notifications';
    else if (notificationType === 'challenge_checkin') channelId = 'challenge_notifications';
    else if (notificationType === 'streak_congrats') channelId = 'streak_notifications';

    const rawDataPayload: { [key: string]: any } = { 
        title, 
        body: message, 
        url: ctaUrl, 
        notificationType, 
        entityId, 
        isCoach: isCoachParam, 
        channelId 
    };

    if (senderId) rawDataPayload.senderId = senderId;
    if (senderName) rawDataPayload.senderName = senderName;
    if (messageText) rawDataPayload.messageText = messageText;
    if (finalImageUrl) rawDataPayload.imageUrl = finalImageUrl;
    if (appointmentStartTimeMillis) rawDataPayload.appointmentStartTimeMillis = appointmentStartTimeMillis;

    // Specific mapping so PushNotificationProvider can trigger the right Zustand state
    if (notificationType === 'chat') rawDataPayload.chatId = entityId;
    else if (notificationType === 'workout_reminder') rawDataPayload.workoutId = entityId;
    else if (['appointment_reminder', 'appointment_booked'].includes(notificationType)) rawDataPayload.appointmentId = entityId;
    else if (notificationType === 'hydration') rawDataPayload.hydration = 'true';
    else if (notificationType.includes('indulgence_')) rawDataPayload.indulgenceId = entityId;
    else if (['challenge_checkin', 'streak_congrats'].includes(notificationType)) {
        rawDataPayload.challengeId = entityId;
        rawDataPayload.openChallengeList = 'true';
    }

    // Convert all payload values to Strings for FCM compatibility
    const dataPayload = Object.keys(rawDataPayload).reduce((acc: any, key) => {
        if (rawDataPayload[key] !== undefined && rawDataPayload[key] !== null) {
            acc[key] = String(rawDataPayload[key]);
        }
        return acc;
    }, {});

    const payload: MulticastMessage = {
        tokens,
        data: dataPayload,
        apns: {
            payload: {
                aps: {
                    alert: { title: truncatedTitle, body: truncatedMessage },
                    badge: 1,
                    sound: 'default',
                    'content-available': 1,
                    'mutable-content': 1,
                },
            },
            ...(finalImageUrl && { fcmOptions: { imageUrl: finalImageUrl } }),
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: truncatedTitle,
                body: truncatedMessage,
                channelId: String(channelId),
                sound: 'default',
                ...(finalImageUrl && { imageUrl: finalImageUrl }),
            },
        },
    };

    try {
        const response = await messaging.sendEachForMulticast(payload);
        debugLog(`FCM SUCCESS - ${notificationType} | Success: ${response.successCount}`);
    } catch (error) {
        console.error(`[sendPushNotification] Error for ${userId}:`, error);
    }
}

// ============================================================================
// FIRESTORE TRIGGERS (Real-time events)
// ============================================================================

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) return;
    const message = event.data.data();
    const chatId = event.params.chatId;
    const senderId = message.senderId || message.from;
    const messageText = message.text || message.content || 'New message';

    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists) return;
    const chat = chatSnap.data();
    if (!chat) return;

    const participants = chat.participants || [];
    const recipientId = participants.find((id: string) => id !== senderId);
    if (!recipientId) return;

    await sendPushNotification(
        recipientId, 
        'New message', 
        messageText, 
        `/coach/dashboard?openChatId=${chatId}&notificationType=chat&isCoach=true`, 
        'chat', 
        chatId, 
        undefined, 
        senderId, 
        undefined, 
        messageText
    );
});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) return;
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    const coachId = appointment.coachId;
    const clientId = appointment.clientId;

    if (coachId) await sendPushNotification(coachId, 'New Appointment', `Appointment with ${await getUserName(clientId)}`, `/coach/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, undefined, 'true');
    if (clientId) await sendPushNotification(clientId, 'Appointment Booked', `Your appointment with ${await getUserName(coachId)} is confirmed`, `/client/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, undefined, 'false');

    // Schedule the 10-minute reminder
    const startTime = appointment.start.toDate ? appointment.start.toDate() : new Date(appointment.start);
    const reminderTime = new Date(startTime.getTime() - 10 * 60 * 1000);
    const queue = getFunctions().taskQueue('appointmentReminderHandler');
    await queue.enqueue({ appointmentId, userId: clientId }, { scheduleTime: reminderTime });
});

export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    if (!event.data) return;
    const workout = event.data.data();
    const workoutId = event.params.workoutId;
    const userId = workout.userId;
    await sendPushNotification(userId, 'Workout Scheduled', `Your workout "${workout.title}" is scheduled`, `/client/dashboard?notificationType=workout_scheduled&entityId=${workoutId}`, 'workout_scheduled', workoutId);
});

export const onReminderScheduled = onDocumentCreated("reminders/{reminderId}", async (event) => {
    if (!event.data) return;
    const reminder = event.data.data();
    const reminderId = event.params.reminderId;
    const userId = reminder.userId;
    await sendPushNotification(userId, reminder.title, reminder.message, `/client/dashboard?notificationType=${reminder.type}&entityId=${reminderId}`, reminder.type, reminderId);
});

export const onIndulgencePlanCreated = onDocumentCreated("indulgencePlans/{planId}", async (event) => {
    if (!event.data) return;
    const plan = event.data.data();
    const planId = event.params.planId;
    const userId = plan.userId;
    await sendPushNotification(userId, 'Indulgence Plan Ready', plan.message || 'Your indulgence plan is ready', `/client/dashboard?notificationType=indulgence_plan&entityId=${planId}`, 'indulgence_plan', planId);
});

export const onChallengeEnrollmentCreated = onDocumentCreated("challenges/{challengeId}/enrollments/{enrollmentId}", async (event) => {
    if (!event.data) return;
    const enrollment = event.data.data();
    const userId = enrollment.userId;
    const challengeId = event.params.challengeId;
    await sendPushNotification(userId, 'Challenge Enrolled', 'You joined a new challenge!', `/client/dashboard?notificationType=challenge_enrolled&entityId=${challengeId}`, 'challenge_enrolled', challengeId);
});

export const onStreakAchieved = onDocumentUpdated("clients/{userId}", async (event) => {
    if (!event.data) return;
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.streak < after.streak) {
        const userId = event.params.userId;
        await sendPushNotification(userId, '🎉 Streak Achieved!', `Congratulations on your ${after.streak}-day streak!`, `/client/dashboard?notificationType=streak_congrats`, 'streak_congrats', `streak-${userId}`);
    }
});

// ============================================================================
// TASK QUEUE HANDLERS (Scheduled events)
// ============================================================================

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, appointmentId } = req.data;
    await sendPushNotification(userId, 'Appointment Reminder', 'Your appointment is in 10 minutes', `/client/dashboard?notificationType=appointment_reminder&entityId=${appointmentId}`, 'appointment_reminder', appointmentId);
});

export const workoutReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, workoutId } = req.data;
    await sendPushNotification(userId, 'Workout Reminder', 'Your workout is in 10 minutes!', `/client/dashboard?notificationType=workout_reminder&entityId=${workoutId}`, 'workout_reminder', workoutId);
});

export const hydrationReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId } = req.data;
    await sendPushNotification(userId, '💧 Time to Hydrate!', 'Don\'t forget to drink water and log it!', `/client/dashboard?openHydration=true&notificationType=hydration`, 'hydration', 'hydration');
});

export const indulgenceReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, planId, type, message } = req.data;
    await sendPushNotification(userId, 'Indulgence Check-in', message || 'Time for your scheduled indulgence!', `/client/dashboard?notificationType=${type}&entityId=${planId}`, type, planId);
});

export const challengeCheckinHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, challengeId } = req.data;
    await sendPushNotification(userId, 'Challenge Check-in', "Don't forget to check in on your progress!", `/client/dashboard?notificationType=challenge_checkin&openChallengeList=true`, 'challenge_checkin', challengeId);
});

// ============================================================================
// TEST ENDPOINT
// ============================================================================

export const testPushNotification = onRequest(async (req, res) => {
    const userId = req.query.userId as string;
    const type = (req.query.type as string) || 'test';
    if (!userId) { res.status(400).send("Please provide a userId."); return; }

    let title = 'Test Notification';
    let message = 'This is a test notification from HungerFree & Happy.';
    let ctaUrl = '/client/dashboard?notificationType=test';
    let entityId = 'test-id';

    if (type === 'chat') {
        title = 'New Test Message';
        message = 'This is a test chat message.';
        ctaUrl = `/client/dashboard?openChatId=test-chat&notificationType=chat&isCoach=false`;
    } else if (type === 'hydration') {
        title = '💧 Time to Hydrate!';
        message = 'This is your test hydration reminder.';
        ctaUrl = '/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false';
    }

    try {
        await sendPushNotification(userId, title, message, ctaUrl, type, entityId);
        res.status(200).send(`Sent '${type}' test to ${userId}.`);
    } catch (error) {
        res.status(500).send("Failed to send.");
    }
});