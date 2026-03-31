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

const safeGetDate = (dateInput: any): Date | null => {
    if (!dateInput) return null;
    if (dateInput.toDate) return dateInput.toDate();
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        const date = new Date(dateInput);
        if (!isNaN(date.getTime())) return date;
    }
    return null;
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

export async function sendPushNotification(userId: string, title: string, message: string, ctaUrl: string, notificationType: string, entityId: string, imageUrl?: string, senderId?: string, senderName?: string, messageText?: string, appointmentStartTimeMillis?: number, isCoachParam?: string) {
    debugLog(`sendPushNotification START - Type: ${notificationType} | User: ${userId}`);

    const userDocRef = await db.collection('clients').doc(userId).get();
    if (!userDocRef.exists) { debugLog(`User ${userId} not found`); return; }

    const tokens = userDocRef.data()?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) { debugLog(`No tokens for user ${userId}`); return; }

    const defaultImageUrl = 'https://firebasestorage.googleapis.com/v0/b/hunger-free-and-happy-app.appspot.com/o/app-assets%2Flogo_icon_transparent_background.png?alt=media&token=4e3b1234-5678-4321-abcd-1234567890ab';
    const finalImageUrl = imageUrl || defaultImageUrl;

    const truncatedTitle = String(title).substring(0, 50);
    const truncatedMessage = String(message).substring(0, 160);

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

    const rawDataPayload: { [key: string]: any } = { title, body: message, url: ctaUrl, notificationType, entityId, isCoach: isCoachParam, channelId };
    if (senderId) rawDataPayload.senderId = senderId;
    if (senderName) rawDataPayload.senderName = senderName;
    if (messageText) rawDataPayload.messageText = messageText;
    if (finalImageUrl) rawDataPayload.imageUrl = finalImageUrl;
    if (appointmentStartTimeMillis) rawDataPayload.appointmentStartTimeMillis = appointmentStartTimeMillis;

    if (notificationType === 'chat') rawDataPayload.chatId = entityId;
    else if (notificationType === 'workout_reminder') rawDataPayload.workoutId = entityId;
    else if (['appointment_reminder', 'appointment_booked'].includes(notificationType)) rawDataPayload.appointmentId = entityId;
    else if (notificationType === 'hydration') rawDataPayload.hydration = 'true';
    else if (notificationType.includes('indulgence_')) rawDataPayload.indulgenceId = entityId;
    else if (['challenge_checkin', 'streak_congrats'].includes(notificationType)) {
        rawDataPayload.challengeId = entityId;
        rawDataPayload.openChallengeList = 'true';
    }

    const dataPayload = Object.keys(rawDataPayload).reduce((acc: any, key) => {
        if (rawDataPayload[key] !== undefined) acc[key] = String(rawDataPayload[key]);
        return acc;
    }, {});

    const payload: MulticastMessage = {
        tokens,
        data: dataPayload,
        apns: {
            payload: {
                aps: {
                    alert: { title: truncatedTitle, body: truncatedMessage },   // ALWAYS visible
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
            notification: {   // ALWAYS visible
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
        console.error(`[sendPushNotification] Catastrophic error for ${userId}:`, error);
    }
}

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, title, message, ctaUrl, notificationType, entityId, imageUrl, isCoachParam, appointmentStartTimeMillis } = req.data;
    await sendPushNotification(userId, title, message, ctaUrl, notificationType, entityId, imageUrl, undefined, undefined, message, appointmentStartTimeMillis, isCoachParam);
});

export const workoutReminderHandler = onTaskDispatched<any>({}, async (req) => { /* your original */ });
export const indulgenceReminderHandler = onTaskDispatched<any>({}, async (req) => { /* your original */ });
export const challengeCheckinHandler = onTaskDispatched<any>({}, async (req) => { /* your original */ });
export const hydrationReminderHandler = onTaskDispatched<any>({}, async (req) => { /* your original */ });

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => { /* your original unchanged */ });

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    debugLog('onAppointmentScheduled TRIGGERED for 10-minute reminder scheduling', event.params.appointmentId);
    if (!event.data) return;
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !appointment.start) return;

    const { clientId, coachId, start } = appointment;
    if (!clientId || !coachId) return;

    const appointmentStartTime = safeGetDate(start);
    if (!appointmentStartTime) {
        console.error(`FATAL: Could not parse 'start' date for appointment ${appointmentId} to schedule a reminder. Value was:`, start);
        return;
    }

    try {
        const reminderTime = new Date(appointmentStartTime.getTime() - 10 * 60 * 1000);
        if (reminderTime > new Date()) {
            const queue = getFunctions().taskQueue('appointmentReminderHandler');
            const [resolvedClientName, resolvedCoachName] = await Promise.all([getUserName(clientId), getUserName(coachId)]);
            
            const ctaUrlCoach = `/coach/dashboard?notificationType=appointment_reminder&openAppointmentId=${appointmentId}&isCoach=true`;
            const ctaUrlClient = `/client/dashboard?notificationType=appointment_reminder&openAppointmentId=${appointmentId}&isCoach=false`;

            await queue.enqueue({ userId: coachId, title: 'Upcoming Appointment', message: `Your appointment with ${resolvedClientName} is in 10 minutes.`, ctaUrl: ctaUrlCoach, notificationType: 'appointment_reminder', entityId: appointmentId, isCoachParam: 'true', appointmentStartTimeMillis: appointmentStartTime.getTime() }, { scheduleTime: reminderTime });
            await queue.enqueue({ userId: clientId, title: 'Upcoming Appointment', message: `Your appointment with ${resolvedCoachName} is in 10 minutes.`, ctaUrl: ctaUrlClient, notificationType: 'appointment_reminder', entityId: appointmentId, isCoachParam: 'false', appointmentStartTimeMillis: appointmentStartTime.getTime() }, { scheduleTime: reminderTime });
            debugLog(`Successfully enqueued 10-minute reminder for appointment ${appointmentId}`);
        }
    } catch (e) {
        console.error(`CRITICAL ERROR while scheduling reminder for appointment ${appointmentId}:`, e);
    }
});

export const onReminderScheduled = onDocumentCreated("reminders/{reminderId}", async (event) => {
    debugLog('onReminderScheduled TRIGGERED', event.params.reminderId);
    if (!event.data) { return; }
    const reminder = event.data.data();
    const { reminderId } = event.params;
    if (!reminder || reminder.type !== 'hydration_reminder' || reminder.status !== 'scheduled') { return; }
    
    const { userId, scheduledAt } = reminder;
    const reminderTime = safeGetDate(scheduledAt);

    if (!reminderTime) {
        console.error(`FATAL: Could not parse 'scheduledAt' date for reminder ${reminderId}. Value was:`, scheduledAt);
        return;
    }

    if (reminderTime > new Date()) {
        try {
            const queue = getFunctions().taskQueue('hydrationReminderHandler');
            await queue.enqueue({ userId, reminderId }, { scheduleTime: reminderTime });
            debugLog(`Successfully enqueued hydration reminder for ${reminderId}`);
        } catch (e) {
            console.error(`CRITICAL ERROR while enqueuing hydration reminder ${reminderId}:`, e);
        }
    }
});

export const onStreakAchieved = onDocumentUpdated("clients/{userId}", async (event) => { /* your original */ });
export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => { /* your hardened version */ });
export const onIndulgencePlanCreated = onDocumentCreated("indulgencePlans/{planId}", async (event) => { /* your hardened version */ });
export const onChallengeEnrollmentCreated = onDocumentCreated("challenges/{challengeId}/enrollments/{enrollmentId}", async (event) => { /* your hardened version */ });

export const testPushNotification = onRequest(async (req, res) => {
    const userId = req.query.userId as string;
    const type = req.query.type as string || 'test';

    if (!userId) {
        res.status(400).send("Please provide a userId.");
        return;
    }

    let title = 'Test Notification';
    let message = 'This is a generic test message.';
    let ctaUrl = '/client/dashboard?notificationType=test';
    let entityId = 'test-id-123';
    let notificationType = type;
    
    // Add a case for 'chat'
    if (type === 'chat') {
        notificationType = 'chat';
        title = 'New Test Message';
        message = 'This is a test chat message from the server.';
        entityId = 'test-chat-123';
        ctaUrl = `/client/dashboard?openChatId=${entityId}&notificationType=chat&isCoach=false`;
    }

    switch (type) {
        case 'appointment_reminder':
            title = 'Upcoming Appointment';
            message = 'Your test appointment is in 10 minutes.';
            entityId = 'test-appointment-123';
            ctaUrl = `/client/dashboard?notificationType=appointment_reminder&openAppointmentId=${entityId}&isCoach=false`;
            break;
        case 'hydration':
            title = '💧 Time to Hydrate!';
            message = 'This is your test hydration reminder.';
            entityId = 'hydration';
            ctaUrl = '/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false';
            break;
        case 'workout_reminder':
            title = 'Workout Reminder';
            message = 'Your test workout, "Test Powerlifting Session", is in 10 minutes!';
            entityId = 'test-workout-123';
            ctaUrl = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${entityId}&isCoach=false`;
            break;
        case 'streak_congrats':
             title = '🎉 Streak Achieved!';
             message = `Congratulations on your 5-day streak! Keep up the great work.`;
             entityId = `streak-${userId}-5`;
             ctaUrl = `/client/dashboard?notificationType=streak_congrats&openChallengeList=true&isCoach=false`;
             break;
        case 'challenge_checkin':
            title = 'Challenge Check-in';
            message = "Don't forget to check in on your challenge progress today!";
            entityId = 'test-challenge-123';
            ctaUrl = `/client/dashboard?notificationType=challenge_checkin&openChallengeList=true&isCoach=false`;
            break;
    }

    try {
        await sendPushNotification(userId, title, message, ctaUrl, notificationType, entityId);
        res.status(200).send(`Successfully sent a '${type}' test notification to ${userId}.`);
    } catch (error) {
        console.error(`Error in testPushNotification for type '${type}':`, error);
        res.status(500).send("Failed to send notification.");
    }
});
