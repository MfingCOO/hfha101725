'use strict';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';

// Standard initialization for Cloud Functions environment
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

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
    if (!userDocRef.exists) { 
        debugLog(`User ${userId} not found in clients`); 
        return; 
    }

    const tokens = userDocRef.data()?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) { 
        debugLog(`No tokens for user ${userId}`); 
        return; 
    }

    const userData = userDocRef.data()!;
    const isCoach = userData.role === 'coach';

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
        isCoach: String(isCoach), 
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
    else if (notificationType === 'hydration' || notificationType === 'hydration_reminder') rawDataPayload.openHydration = 'true';
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
        notification: { title: truncatedTitle, body: truncatedMessage },
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
};

// ============================================================================
// FIRESTORE TRIGGERS
// ============================================================================

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    debugLog('=== onNewMessage TRIGGERED ===', event.params.messageId);
    if (!event.data) {
        debugLog('Abort: No event.data');
        return;
    }
    const message = event.data.data();
    const chatId = event.params.chatId;
    const senderId = message.userId || message.senderId || message.from;
    const messageText = message.text || 'New message';

    debugLog('Raw message data:', message);
    debugLog('Sender ID (final):', senderId);

    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists) {
        debugLog('Abort: Chat document does not exist');
        return;
    }
    const chat = chatSnap.data()!;

    debugLog('FULL participants array from Firestore:', chat.participants);

    const participants: string[] = chat.participants || [];
    const recipientIds = participants.filter((id: string) => id !== senderId);

    debugLog('Filtered recipientIds (should NOT include sender):', recipientIds);

    if (recipientIds.length === 0) {
        debugLog("Abort: No valid recipient (sender is the only participant)");
        return;
    }

    const recipientId = recipientIds[0];

    debugLog('FINAL recipient we are sending to:', recipientId);

    const senderName = await getUserName(senderId);
    const title = chat.name ? `New message in ${chat.name}` : `New message from ${senderName}`;

    const recipientDoc = await db.collection('clients').doc(recipientId).get();
    if (!recipientDoc.exists) {
        debugLog(`Recipient ${recipientId} not found`);
        return;
    }

    const recipientData = recipientDoc.data()!;
    const isCoach = recipientData.role === 'coach';
    const dashboardBase = isCoach ? '/coach/dashboard' : '/client/dashboard';
    const ctaUrl = `${dashboardBase}?openChatId=${chatId}&notificationType=chat&isCoach=${isCoach}`;

    debugLog(`Sending to ${recipientId} (isCoach=${isCoach}) with URL: ${ctaUrl}`);

    await sendPushNotification(
        recipientId, 
        title, 
        messageText, 
        ctaUrl, 
        'chat', 
        chatId, 
        undefined, 
        senderId, 
        senderName, 
        messageText, 
        undefined, 
        String(isCoach)
    );
});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) return;
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;

    const startTimeDate = appointment.start?.toDate ? appointment.start.toDate() : new Date(appointment.start);
    const startTimeMillis = startTimeDate.getTime();

    if (appointment.coachId) {
        const clientName = await getUserName(appointment.clientId);
        await sendPushNotification(appointment.coachId, 'New Appointment', `Appointment with ${clientName}`, `/coach/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, startTimeMillis, 'true');
    }

    if (appointment.clientId) {
        const coachName = await getUserName(appointment.coachId);
        await sendPushNotification(appointment.clientId, 'Appointment Booked', `Your appointment with ${coachName} is confirmed`, `/client/dashboard?notificationType=appointment_booked&entityId=${appointmentId}`, 'appointment_booked', appointmentId, undefined, undefined, undefined, undefined, startTimeMillis, 'false');
    }

    const reminderTime = new Date(startTimeDate.getTime() - 10 * 60 * 1000);
    if (reminderTime > new Date()) {
        const queue = getFunctions().taskQueue('appointmentReminderHandler');
        await queue.enqueue({ appointmentId, userId: appointment.clientId, startTimeMillis }, { scheduleTime: reminderTime });
    }
});

// This function now exclusively handles scheduling for HYDRATION and other RECURRING reminders.
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

// NEW: This function exclusively handles scheduling for CUSTOM POPUPS sent by coaches.
export const onCustomPopupCreated = onDocumentCreated("clients/{userId}/notifications/{notificationId}", async (event) => {
    if (!event.data) return;
    const popup = event.data.data();
    const userId = event.params.userId;
    const notificationId = event.params.notificationId;

    // IMPORTANT: Only act on documents that are 'custom-popup' and have a schedule.
    if (popup.type !== 'custom-popup' || !popup.scheduledAt) {
        return;
    }

    const scheduledAt = popup.scheduledAt.toDate ? popup.scheduledAt.toDate() : new Date(popup.scheduledAt);
    
    // Use the existing reminderTaskHandler to do the final sending.
    const queue = getFunctions().taskQueue('reminderTaskHandler');
    
    // If the scheduled time is in the future, schedule the task. Otherwise, send it immediately.
    if (scheduledAt > new Date()) {
        await queue.enqueue({ 
            userId, 
            reminderId: notificationId, // Pass the ID of the document from this collection
            isCustomPopup: true // Add a flag to ensure the handler knows what this is
        }, { scheduleTime: scheduledAt });
    } else {
        await queue.enqueue({ userId, reminderId: notificationId, isCustomPopup: true });
    }
});

export const onWorkoutScheduled = onDocumentCreated("workouts/{workoutId}", async (event) => {
    if (!event.data) return;
    const workout = event.data.data();
    const workoutId = event.params.workoutId;

    await sendPushNotification(
        workout.userId, 
        'Workout Scheduled', 
        `Your workout "${workout.title}" is scheduled`, 
        `/client/dashboard?notificationType=workout_scheduled&entityId=${workoutId}`, 
        'workout_scheduled', 
        workoutId
    );

    const startTimeDate = workout.start?.toDate ? workout.start.toDate() : new Date(workout.start);
    const reminderTime = new Date(startTimeDate.getTime() - 10 * 60 * 1000);

    if (reminderTime > new Date()) {
        const queue = getFunctions().taskQueue('workoutReminderHandler');
        await queue.enqueue({ userId: workout.userId, workoutId, title: workout.title }, { scheduleTime: reminderTime });
    }
});

export const onIndulgencePlanCreated = onDocumentCreated("indulgencePlans/{planId}", async (event) => {
    if (!event.data) return;
    const plan = event.data.data();
    const planId = event.params.planId;
    const userId = plan.userId;

    const queue = getFunctions().taskQueue('indulgenceReminderHandler');
    const indulgenceTime = (plan.startTime as Timestamp).toDate();

    const now = new Date();

    // 1. Pep talk reminder (-10 hours)
    const tenHoursBefore = new Date(indulgenceTime.getTime() - (10 * 3600 * 1000));
    if (tenHoursBefore > now) {
        await queue.enqueue(
            { userId, planId, type: 'pre_indulgence_pep_talk', message: "You've got this! Stick to your plan and enjoy your treat guilt-free." },
            { scheduleTime: tenHoursBefore }
        );
    }

    // 2. Enjoyment reminder (-2 hours)
    const twoHoursBefore = new Date(indulgenceTime.getTime() - (2 * 3600 * 1000));
    if (twoHoursBefore > now) {
        await queue.enqueue(
            { userId, planId, type: 'pre_indulgence_enjoy', message: "It's almost time! Savor and enjoy your indulgence." },
            { scheduleTime: twoHoursBefore }
        );
    }

    // 3. Recovery reminder (+12 hours)
    const twelveHoursAfter = new Date(indulgenceTime.getTime() + (12 * 3600 * 1000));
    if (twelveHoursAfter > now) {
        await queue.enqueue(
            { userId, planId, type: 'post_indulgence_recovery', message: "Hope you enjoyed it! Now let's get back on track with your recovery plan." },
            { scheduleTime: twelveHoursAfter }
        );
    }
});

export const onChallengeEnrollmentCreated = onDocumentCreated("clientChallenges/{enrollmentId}", async (event) => {
    if (!event.data) return;
    const enrollment = event.data.data();
    const userId = enrollment.userId;
    const challengeId = enrollment.challengeId;
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
    const { userId, reminderId, isCustomPopup } = req.data; // Destructure the new flag

    // Determine which collection to read from based on the flag
    const collectionPath = isCustomPopup ? `clients/${userId}/notifications` : 'user_scheduled_reminders';
    const doc = await db.collection(collectionPath).doc(reminderId).get();
    
    if (!doc.exists) return;
    const reminder = doc.data()!;

    const ctaUrl = `/client/dashboard?notificationType=${reminder.type}&entityId=${reminderId}`;
    await sendPushNotification(userId, reminder.title, reminder.message, ctaUrl, reminder.type, reminderId, reminder.imageUrl);

    // This logic should only run for recurring hydration reminders, not for one-off popups
    if (reminder.isRecurring && !isCustomPopup) {
        const nextTime = new Date(reminder.scheduledAt.toDate().getTime() + 24 * 60 * 60 * 1000);
        await doc.ref.update({ scheduledAt: nextTime, status: 'scheduled' });
        const queue = getFunctions().taskQueue('reminderTaskHandler');
        await queue.enqueue({ userId, reminderId }, { scheduleTime: nextTime });
    } else {
        // Mark as completed if it's not a recurring hydration reminder
        await doc.ref.update({ status: 'completed', seen: true });
    }
});

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, appointmentId, startTimeMillis } = req.data; 
    const ctaUrl = `/client/dashboard?notificationType=appointment_reminder&entityId=${appointmentId}`;
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
