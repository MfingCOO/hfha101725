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

    let channelId = 'default';
    if (notificationType === 'chat') channelId = 'chat_messages';
    else if (notificationType === 'appointment_booked') channelId = 'appointment_booked_notifications';
    else if (notificationType === 'appointment_reminder') channelId = 'appointment_reminders';
    else if (notificationType === 'workout_reminder') channelId = 'workout_reminders';
    else if (notificationType === 'hydration' || notificationType === 'hydration_reminder') channelId = 'hydration_reminders';
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
        isCoach: isCoachParam || 'false', 
        channelId 
    };

    if (senderId) rawDataPayload.senderId = senderId;
    if (senderName) rawDataPayload.senderName = senderName;
    if (messageText) rawDataPayload.messageText = messageText;
    if (finalImageUrl) rawDataPayload.imageUrl = finalImageUrl;
    if (appointmentStartTimeMillis) rawDataPayload.appointmentStartTimeMillis = appointmentStartTimeMillis;

    if (notificationType === 'chat') rawDataPayload.chatId = entityId;
    else if (notificationType === 'workout_reminder') rawDataPayload.workoutId = entityId;
    else if (['appointment_reminder', 'appointment_booked'].includes(notificationType)) rawDataPayload.appointmentId = entityId;
    else if (notificationType === 'hydration' || notificationType === 'hydration_reminder') rawDataPayload.hydration = 'true';
    else if (notificationType.includes('indulgence_')) rawDataPayload.indulgenceId = entityId;
    else if (['challenge_checkin', 'streak_congrats'].includes(notificationType)) {
        rawDataPayload.challengeId = entityId;
        rawDataPayload.openChallengeList = 'true';
    }

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
// FIRESTORE TRIGGERS
// ============================================================================

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) return;
    const message = event.data.data();
    const chatId = event.params.chatId;
    const senderId = message.senderId || message.from;
    const messageText = message.text || 'New message';

    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists) return;
    const chat = chatSnap.data()!;

    const recipientId = (chat.participants || []).find((id: string) => id !== senderId);
    if (!recipientId) return;

    const senderName = await getUserName(senderId);
    const title = chat.name ? `New message in ${chat.name}` : `New message from ${senderName}`;

    const recipientDoc = await db.collection('clients').doc(recipientId).get();
    const isClient = recipientDoc.exists;
    const dashboardBase = isClient ? '/client/dashboard' : '/coach/dashboard';
    const ctaUrl = `${dashboardBase}?openChatId=${chatId}&notificationType=chat&isCoach=${!isClient}`;

    await sendPushNotification(recipientId, title, messageText, ctaUrl, 'chat', chatId, undefined, senderId, senderName, messageText, undefined, String(!isClient));
});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) return;
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;

    const startTimeDate = appointment.start?.toDate ? appointment.start.toDate() : new Date(appointment.start);
    const startTimeMillis = startTimeDate.getTime();

    if (appointment.coachId) {
        const clientName = await getUserName(appointment.clientId);
        const coachUrl = `/coach/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`;
        await sendPushNotification(appointment.coachId, 'New Appointment', `Appointment with ${clientName}`, coachUrl, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, startTimeMillis, 'true');
    }

    if (appointment.clientId) {
        const coachName = await getUserName(appointment.coachId);
        const clientUrl = `/client/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`;
        await sendPushNotification(appointment.clientId, 'Appointment Booked', `Your appointment with ${coachName} is confirmed`, clientUrl, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, startTimeMillis, 'false');
    }

    const reminderTime = new Date(startTimeDate.getTime() - 10 * 60 * 1000);
    if (reminderTime > new Date()) {
        const queue = getFunctions().taskQueue('appointmentReminderHandler');
        await queue.enqueue({ appointmentId, userId: appointment.clientId, startTimeMillis }, { scheduleTime: reminderTime });
    }
});

export const onReminderScheduled = onDocumentCreated("user_scheduled_reminders/{reminderId}", async (event) => {
    if (!event.data) return;
    const reminder = event.data.data();
    const reminderId = event.params.reminderId;
    const scheduledAt = reminder.scheduledAt?.toDate ? reminder.scheduledAt.toDate() : new Date(reminder.scheduledAt);
    const queue = getFunctions().taskQueue('reminderTaskHandler');
    
    if (scheduledAt > new Date()) {
        await queue.enqueue({ userId: reminder.userId, reminderId }, { scheduleTime: scheduledAt });
    } else {
        await queue.enqueue({ userId: reminder.userId, reminderId });
    }
});

export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    if (!event.data) return;
    const workout = event.data.data();
    const workoutId = event.params.workoutId;

    // 1. Send the immediate confirmation
    await sendPushNotification(
        workout.userId, 
        'Workout Scheduled', 
        `Your workout "${workout.title}" is scheduled`, 
        `/client/dashboard?notificationType=workout_scheduled&entityId=${workoutId}`, 
        'workout_scheduled', 
        workoutId
    );

    // 2. NEW: Schedule the 10-minute reminder
    // Assuming 'workout.start' is a Firestore Timestamp
    const startTimeDate = workout.start?.toDate ? workout.start.toDate() : new Date(workout.start);
    const reminderTime = new Date(startTimeDate.getTime() - 10 * 60 * 1000);

    if (reminderTime > new Date()) {
        const queue = getFunctions().taskQueue('workoutReminderHandler');
        await queue.enqueue({ 
            userId: workout.userId, 
            workoutId,
            title: workout.title // Passing title so the reminder is personalized
        }, { scheduleTime: reminderTime });
        
        debugLog(`Workout reminder enqueued for ${reminderTime.toISOString()}`);
    }
});

export const onIndulgencePlanCreated = onDocumentCreated("indulgencePlans/{planId}", async (event) => {
    if (!event.data) return;
    const plan = event.data.data();
    const planId = event.params.planId;
    const userId = plan.userId;

    // 1. Immediate Notification
    await sendPushNotification(
        userId, 
        'Indulgence Plan Ready', 
        plan.message || 'Your indulgence plan is ready', 
        `/client/dashboard?notificationType=indulgence_plan&entityId=${planId}`, 
        'indulgence_plan', 
        planId
    );

    // Get the event time (Change 'plan.scheduledAt' to your actual field name if different)
    const eventTime = plan.scheduledAt?.toDate ? plan.scheduledAt.toDate() : new Date(plan.scheduledAt);
    const queue = getFunctions().taskQueue('indulgenceReminderHandler');

    // 2. Schedule: 12 Hours Before (Remind of the plan)
    const twelveHoursBefore = new Date(eventTime.getTime() - 12 * 60 * 60 * 1000);
    if (twelveHoursBefore > new Date()) {
        await queue.enqueue({ 
            userId, planId, 
            type: 'indulgence_reminder_12h', 
            message: "Don't forget the indulgence plan you set for later today!" 
        }, { scheduleTime: twelveHoursBefore });
    }

    // 3. Schedule: 2 Hours Before (Encouragement)
    const twoHoursBefore = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000);
    if (twoHoursBefore > new Date()) {
        await queue.enqueue({ 
            userId, planId, 
            type: 'indulgence_reminder_2h', 
            message: "Almost time! We hope you really enjoy yourself." 
        }, { scheduleTime: twoHoursBefore });
    }

    // 4. Schedule: 12 Hours After (Recovery Plan)
    const twelveHoursAfter = new Date(eventTime.getTime() + 12 * 60 * 60 * 1000);
    await queue.enqueue({ 
        userId, planId, 
        type: 'indulgence_recovery', 
        message: "We hope you had a great time! Let's get back on track with your recovery plan." 
    }, { scheduleTime: twelveHoursAfter });
});

export const onChallengeEnrollmentCreated = onDocumentCreated("challenges/{challengeId}/enrollments/{enrollmentId}", async (event) => {
    if (!event.data) return;
    const userId = event.data.data().userId;
    const challengeId = event.params.challengeId;
    await sendPushNotification(userId, 'Challenge Enrolled', 'You joined a new challenge!', `/client/dashboard?notificationType=challenge_enrolled&entityId=${challengeId}`, 'challenge_enrolled', challengeId);
});

export const onStreakAchieved = onDocumentUpdated("clients/{userId}", async (event) => {
    if (!event.data) return;
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before.streak < after.streak) {
        await sendPushNotification(event.params.userId, '🎉 Streak Achieved!', `Congratulations on your ${after.streak}-day streak!`, `/client/dashboard?notificationType=streak_congrats`, 'streak_congrats', `streak-${event.params.userId}`);
    }
});

// ============================================================================
// TASK QUEUE HANDLERS
// ============================================================================

export const reminderTaskHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, reminderId } = req.data;
    const doc = await db.collection('user_scheduled_reminders').doc(reminderId).get();
    if (!doc.exists) return;
    const reminder = doc.data()!;

    const ctaUrl = `/client/dashboard?openHydration=true&notificationType=${reminder.type}&entityId=${reminderId}`;
    await sendPushNotification(userId, reminder.title, reminder.message, ctaUrl, reminder.type, reminderId, reminder.imageUrl);

    if (reminder.isRecurring) {
        const nextTime = new Date(reminder.scheduledAt.toDate().getTime() + 24 * 60 * 60 * 1000);
        await doc.ref.update({ scheduledAt: nextTime, status: 'scheduled' });
        const queue = getFunctions().taskQueue('reminderTaskHandler');
        await queue.enqueue({ userId, reminderId }, { scheduleTime: nextTime });
    } else {
        await doc.ref.update({ status: 'completed' });
    }
});

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, appointmentId, startTimeMillis } = req.data; // Added startTimeMillis here
    const ctaUrl = `/client/dashboard?notificationType=appointment_reminder&entityId=${appointmentId}`;
    // Added startTimeMillis below so it actually sends to the phone
    await sendPushNotification(userId, 'Appointment Reminder', 'Your appointment is in 10 minutes', ctaUrl, 'appointment_reminder', appointmentId, undefined, undefined, undefined, undefined, startTimeMillis);
});

export const workoutReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, workoutId } = req.data;
    await sendPushNotification(userId, 'Workout Reminder', 'Your workout is in 10 minutes!', `/client/dashboard?notificationType=workout_reminder&entityId=${workoutId}`, 'workout_reminder', workoutId);
});

export const hydrationReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId } = req.data;
    await sendPushNotification(userId, '💧 Time to Hydrate!', "Don't forget to drink water!", '/client/dashboard?openHydration=true&notificationType=hydration', 'hydration', 'hydration');
});

export const indulgenceReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, planId, type, message } = req.data;
    await sendPushNotification(userId, 'Indulgence Check-in', message || 'Time for your indulgence!', `/client/dashboard?notificationType=${type}&entityId=${planId}`, type, planId);
});

export const challengeCheckinHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, challengeId } = req.data;
    await sendPushNotification(userId, 'Challenge Check-in', "Check in on your progress!", `/client/dashboard?notificationType=challenge_checkin&openChallengeList=true`, 'challenge_checkin', challengeId);
});

// ============================================================================
// TEST ENDPOINT
// ============================================================================

export const testPushNotification = onRequest(async (req, res) => {
    const userId = req.query.userId as string;
    const type = (req.query.type as string) || 'test';
    if (!userId) { res.status(400).send("Provide userId"); return; }

    let ctaUrl = '/client/dashboard?notificationType=test';
    if (type === 'hydration') ctaUrl = '/client/dashboard?openHydration=true&notificationType=hydration';

    try {
        await sendPushNotification(userId, 'Test Title', 'Test Message', ctaUrl, type, 'test-id');
        res.status(200).send(`Sent ${type} to ${userId}`);
    } catch (e) {
        res.status(500).send("Error");
    }
});