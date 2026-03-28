'use strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore'; // MODIFIED: Added Timestamp
import { getMessaging, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';
import { createUserNotification } from '../services/reminders'; // MODIFIED: Changed import path to relative

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

// **CRITICAL FIX:** Export sendPushNotification so it can be imported by other files
export async function sendPushNotification(userId: string, title: string, message: string, ctaUrl: string, notificationType: string, entityId: string, imageUrl?: string, senderId?: string, senderName?: string, messageText?: string, appointmentStartTimeMillis?: number, isCoachParam?: string) {
    const userDocRef = await db.collection('clients').doc(userId).get();

    if (!userDocRef.exists) {
        console.log(`sendPushNotification: User profile ${userId} not found in 'clients' collection.`);
        return;
    }

    const tokens = userDocRef.data()?.fcmTokens?.filter((t: any) => typeof t === 'string' && t) || [];
    if (tokens.length === 0) {
        console.log(`sendPushNotification: User ${userId} has no valid FCM tokens.`);
        return;
    }

    // **MODIFIED:** Granular channelId assignment based on notificationType, specifically for new notification types
    let channelId: string;
    if (notificationType === 'chat') {
        channelId = 'chat_messages';
    } else if (notificationType === 'appointment_booked') { // Distinct channel for immediate booking notifications
        channelId = 'appointment_booked_notifications';
    } else if (notificationType === 'appointment_reminder') { // Distinct channel for time-based reminders
        channelId = 'appointment_reminders';
    } else if (notificationType === 'workout_reminder') {
        channelId = 'workout_reminders';
    } else if (notificationType === 'hydration') {
        channelId = 'hydration_reminders';
    } else if (notificationType === 'custom-popup') { 
        channelId = 'custom_popups'; 
    } else if (notificationType.includes('indulgence_')) { // Covers indulgence_prep, indulgence_checkin, indulgence_recover
        channelId = 'indulgence_notifications';
    } else if (notificationType === 'challenge_checkin') {
        channelId = 'challenge_notifications';
    } else if (notificationType === 'streak_congrats') {
        channelId = 'streak_notifications';
    }
    else {
        channelId = 'default'; // Fallback channel
    }

    // **MODIFIED:** rawDataPayload constructed first with raw values
    const rawDataPayload: { [key: string]: any } = {
        title: title,
        body: message,
        url: ctaUrl, // VERIFIED: This is correctly included for all callers
        notificationType: notificationType,
        entityId: entityId,
        isCoach: isCoachParam, // **CRITICAL FIX:** Use the passed isCoachParam directly
    };

    if (senderId) rawDataPayload.senderId = senderId;
    if (senderName) rawDataPayload.senderName = senderName;
    if (messageText) rawDataPayload.messageText = messageText;
    if (imageUrl) rawDataPayload.imageUrl = imageUrl;
    if (appointmentStartTimeMillis) rawDataPayload.appointmentStartTimeMillis = appointmentStartTimeMillis;

    // Conditionally add specific IDs based on notificationType
    if (notificationType === 'chat') {
        rawDataPayload.chatId = entityId;
    } else if (notificationType === 'workout_reminder') {
        rawDataPayload.workoutId = entityId;
    } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType)) {
        rawDataPayload.appointmentId = entityId;
    } else if (notificationType === 'hydration') {
        rawDataPayload.hydration = 'true';
    } else if (notificationType.includes('indulgence_')) {
        rawDataPayload.indulgenceId = entityId;
        // Optionally add start/end times if needed by frontend for context
        if (appointmentStartTimeMillis) rawDataPayload.indulgenceStartTimeMillis = appointmentStartTimeMillis; // Reusing param name for convenience
    } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType)) {
        rawDataPayload.challengeId = entityId; // Or streakId if separate
        rawDataPayload.openChallengeList = 'true'; // To indicate opening challenge list directly
    }


    // **NEW:** Universally stringify all values in dataPayload to prevent ClassCastException
    const dataPayload: { [key: string]: string } = Object.keys(rawDataPayload).reduce((acc, key) => {
        acc[key] = String(rawDataPayload[key]);
        return acc;
    }, {} as { [key: string]: string });

    // Construct the top-level notification object
    const notificationPayload: { [key: string]: any } = {
        title: String(title),
        body: String(message),
        imageUrl: imageUrl, // FCM notification object expects string or undefined
    };

    // **NEW SURGICAL FIX:** Conditionally add android_channel_id to top-level notification for REMINDER types
    // This targets all non-chat notifications for correct background channel routing.
    // Chat notifications showed regression when this was universally applied, so it's conditional.
    if (['appointment_booked_notifications', 'appointment_reminders', 'workout_reminders', 'hydration_reminders', 'custom_popups', 'indulgence_notifications', 'challenge_notifications', 'streak_notifications'].includes(channelId)) {
        notificationPayload.android_channel_id = String(channelId);
    }

    const payload: MulticastMessage = {
        tokens: tokens,
        notification: notificationPayload as any, // Type assertion to allow android_channel_id in top-level notification object
        data: dataPayload, // Your custom data payload, now all strings
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
            },
        },
    };

    let response: BatchResponse;
    try {
        response = await messaging.sendEachForMulticast(payload);
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
                const currentTokens = userDocRef.data()?.fcmTokens || [];
                const updatedTokens = currentTokens.filter((token: string) => !tokensToRemove.includes(token));
                await db.collection('clients').doc(userId).update({ fcmTokens: updatedTokens });
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
    // **MODIFIED:** More robust messageText determination to fix "undefined" for picture-only chats
    const messageText = (message.text && String(message.text).trim().length > 0)
        ? String(message.text)
        : (message.fileUrl ? 'You received a new attachment' : '[Empty Message]');

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

        // **CRITICAL FIX:** Corrected argument passing for sendPushNotification for chat
        // Passes 'messageText' for 'messageText' (9th param) and 'undefined' for 'appointmentStartTimeMillis' (10th param)
        return sendPushNotification(recipientId, title, body, ctaUrl, 'chat', String(chatId), imageUrl || undefined, senderId, senderName || '', messageText, undefined, isRecipientCoach ? String(true) : String(false));
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
        // **CRITICAL FIX:** Corrected argument passing for sendPushNotification
        return await sendPushNotification(userId, 'Test Notification', 'This is a test message.', '/client/dashboard?notificationType=test', 'test', 'test-id', undefined, undefined, undefined, 'This is a test message.', undefined, String(false));
    } catch (error) {
        res.status(500).send("Failed to send notification.");
    }
});

export const workoutReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, workoutId, workoutName } = req.data;
    const docRef = db.collection('scheduledWorkouts').doc(workoutId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.status === 'reminder_sent') { return; }

    const ctaUrl = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${String(workoutId)}&isCoach=false`;

    // **CRITICAL FIX:** Corrected argument passing for sendPushNotification
    await sendPushNotification(userId, 'Workout Reminder', `Your scheduled workout, "${workoutName}," is in 10 minutes!`, ctaUrl, 'workout_reminder', String(workoutId), undefined, undefined, undefined, `Your scheduled workout, "${workoutName}," is in 10 minutes!`, undefined, String(false));
    await docRef.update({ status: 'reminder_sent' });
});

export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    if (!event.data) { return; }
    const workout = event.data.data();
    const workoutId = event.params.workoutId;
    if (!workout || !event.data.createTime || workout.status !== 'scheduled') { return; }

    const { userId, workoutName, scheduledDate } = workout;
    const reminderTime = new Date(scheduledDate.toMillis() - 10 * 60 * 1000);

    const queue = getFunctions().taskQueue('workoutReminderHandler');
    try {
        await queue.enqueue({ userId, workoutId, workoutName }, { scheduleTime: reminderTime });
    } catch (error) {
        console.error(`Error enqueuing task for workout ${workoutId}:`, error);
    }
});

export const appointmentReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, appointmentId, isCoach, opponentName, eventTitle, appointmentStartTimeMillis } = req.data;
    let title = 'Upcoming Appointment';
    let message = `Your appointment with ${opponentName || 'your coach/client'} is in 10 minutes.`;
    if (eventTitle) {
        title = 'Live Event Starting Soon';
        message = `The event "${eventTitle}" is starting in 10 minutes!`;
    }
    const dashboardUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';
    const ctaUrl = `${dashboardUrl}?notificationType=appointment_reminder&openAppointmentId=${appointmentId}&isCoach=${String(isCoach)}`;

    // **CRITICAL FIX:** Corrected argument passing for sendPushNotification, Number() conversion for appointmentStartTimeMillis
    await sendPushNotification(userId, title, message, ctaUrl, 'appointment_reminder', appointmentId, undefined, undefined, undefined, message, Number(appointmentStartTimeMillis), String(isCoach));


});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) { return; }
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !event.data.createTime || !appointment.start) { return; }

    const reminderTime = new Date(appointment.start.toMillis() - 10 * 60 * 1000);

    const queue = getFunctions().taskQueue('appointmentReminderHandler');
    if (appointment.type === 'one_on_one') { // **MODIFIED:** Pass appointmentStartTimeMillis
        const { clientId, coachId } = appointment;
        const genericClientName = 'your client';
        const genericCoachName = 'your coach';

        const tasks: Promise<any>[] = [];
        if (clientId) {
            tasks.push(queue.enqueue({ userId: clientId, appointmentId, isCoach: false, opponentName: genericCoachName, appointmentStartTimeMillis: appointment.start.toMillis() }, { scheduleTime: reminderTime }));
        }
        if (coachId) {
            tasks.push(queue.enqueue({ userId: coachId, appointmentId, isCoach: true, opponentName: genericClientName, appointmentStartTimeMillis: appointment.start.toMillis() }, { scheduleTime: reminderTime }));
        }
        try {
            await Promise.all(tasks);
        } catch (error) {
            console.error(`onAppointmentScheduled: Error enqueuing one-on-one appointment tasks for appointment ${appointmentId}:`, error);
        }
            
    } else if (appointment.liveEventId) {
        const liveEventDoc = await db.collection('live-events').doc(appointment.liveEventId).get();
        if (!liveEventDoc.exists) return;
        const liveEvent = liveEventDoc.data()!;
        const attendees = liveEvent.attendees || [];
        if (attendees.length === 0) return;
        const eventTitle = liveEvent.title || 'your live event';
        const attendeeTasks = attendees.map((attendeeId: string) => {
            return queue.enqueue({ userId: attendeeId, appointmentId, isCoach: false, eventTitle, appointmentStartTimeMillis: appointment.start.toMillis() }, { scheduleTime: reminderTime });
        });
        try {
            await Promise.all(attendeeTasks);
        } catch (error) {
            console.error(`onAppointmentScheduled: Error enqueuing live event tasks for appointment ${appointmentId}:`, error);
        }
            
    }
});

export const hydrationReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, reminderId } = req.data;
    const docRef = db.collection('reminders').doc(reminderId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.status === 'reminder_sent') { return; }
    const reminder = doc.data()!;
    const scheduledTime = reminder.scheduledAt.toDate();
    const timeString = scheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const message = `This is your ${timeString} hydration reminder.`;

    const ctaUrl = '/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false';
    const iconUrl = 'https://storage.googleapis.com/hunger-free-and-happy-app.appspot.com/app-assets/water-drop-icon.png';

    await sendPushNotification(userId, '💧 Time to Hydrate!', message, ctaUrl, 'hydration', 'hydration', iconUrl, undefined, undefined, message, undefined, String(false)); // Pass messageText, Assume not coach for hydration

    // Mark the current reminder as sent
    docRef.update({ status: 'sent' }); // This updates the status of the *current* reminder (which triggered this handler)

    // RECURRENCE LOGIC: If the reminder is recurring, schedule the next one for the next day.
    if (reminder.isRecurring) {
        const nextScheduledAt = new Date(scheduledTime.getTime());
        nextScheduledAt.setDate(nextScheduledAt.getDate() + 1);

        // Create a new reminder document for the next day
        await db.collection('reminders').add({
            ...reminder,
            scheduledAt: nextScheduledAt,
            status: 'scheduled',
            createdAt: new Date()
        });
    }
});

export const onReminderScheduled = onDocumentCreated("reminders/{reminderId}", async (event) => {
    if (!event.data) { return; }
    const reminder = event.data.data();
    const { reminderId } = event.params;
    if (!reminder || reminder.type !== 'hydration_reminder' || reminder.status !== 'scheduled' || !event.data.createTime) { return; }

    const { userId, scheduledAt } = reminder;
    const reminderTime = scheduledAt.toDate();

    const queue = getFunctions().taskQueue('hydrationReminderHandler');
    try {
        await queue.enqueue({ userId, reminderId }, { scheduleTime: reminderTime });
    } catch (error) {
        console.error(`onReminderScheduled: Error enqueuing task for reminder ${reminderId}:`, error);
    }
});

// --- Indulgence Planner Notifications (Phase 2, Step 2.2) ---

export const indulgenceReminderHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, indulgenceId, type, indulgenceStartTimeMillis, indulgenceEndTimeMillis } = req.data;
    let title: string;
    let message: string;
    let relevantTimeMillis: number | undefined;

    const ctaUrl = `/client/dashboard?notificationType=${type}&openIndulgenceId=${indulgenceId}&isCoach=false`;

    switch (type) {
        case 'indulgence_prep':
            title = 'Indulgence Prep Reminder';
            message = 'Your indulgence event is coming up! Time to get ready.';
            relevantTimeMillis = indulgenceStartTimeMillis;
            break;
        case 'indulgence_checkin':
            title = 'Indulgence Check-in';
            message = 'Your indulgence event is happening soon. How are you feeling?';
            relevantTimeMillis = indulgenceStartTimeMillis;
            break;
        case 'indulgence_recover':
            title = 'Indulgence Recovery';
            message = 'Your indulgence event has passed. Time to reflect and recover.';
            relevantTimeMillis = indulgenceEndTimeMillis;
            break;
        default:
            console.error(`Unknown indulgence notification type: ${type}`);
            return;
    }

    await sendPushNotification(userId, title, message, ctaUrl, type, indulgenceId, undefined, undefined, undefined, message, relevantTimeMillis, String(false));
    console.log(`Indulgence notification sent to user ${userId} for type ${type}`);
});

export const onIndulgencePlanCreated = onDocumentCreated("indulgencePlans/{planId}", async (event) => {
    if (!event.data) { return; }
    const indulgencePlan = event.data.data();
    const indulgenceId = event.params.planId;
    if (!indulgencePlan || !indulgencePlan.userId || !indulgencePlan.startTime || !indulgencePlan.endTime) { return; }

    const { userId, startTime, endTime } = indulgencePlan;
    const indulgenceStartTimeMillis = startTime.toMillis();
    const indulgenceEndTimeMillis = endTime.toMillis();

    const queue = getFunctions().taskQueue('indulgenceReminderHandler');
    const tasks: Promise<any>[] = [];

    // 12 hours before start (Prep)
    const prepTime = new Date(indulgenceStartTimeMillis - 12 * 60 * 60 * 1000);
    if (prepTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_prep', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: prepTime }));
    }

    // 2 hours before start (Check-in)
    const checkinTime = new Date(indulgenceStartTimeMillis - 2 * 60 * 60 * 1000);
    if (checkinTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_checkin', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: checkinTime }));
    }

    // 8 hours after end (Recovery)
    const recoverTime = new Date(indulgenceEndTimeMillis + 8 * 60 * 60 * 1000);
    if (recoverTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_recover', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: recoverTime }));
    }

    try {
        await Promise.all(tasks);
        console.log(`Scheduled indulgence reminders for plan ${indulgenceId}`);
    } catch (error) {
        console.error(`Error scheduling indulgence reminders for plan ${indulgenceId}:`, error);
    }
});


// --- Challenge Check-in Notification (Phase 2, Step 2.3) ---

export const challengeCheckinHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, challengeId } = req.data;
    const title = 'Challenge Check-in';
    const message = 'Don\'t forget to check in on your challenge progress today!';
    const ctaUrl = `/client/dashboard?notificationType=challenge_checkin&openChallengeList=true&isCoach=false`;

    await sendPushNotification(userId, title, message, ctaUrl, 'challenge_checkin', challengeId, undefined, undefined, undefined, message, undefined, String(false));
    console.log(`Challenge check-in notification sent to user ${userId} for challenge ${challengeId}`);
});

export const onChallengeEnrollmentCreated = onDocumentCreated("challenges/{challengeId}/enrollments/{enrollmentId}", async (event) => {
    if (!event.data) { return; }
    const enrollment = event.data.data();
    // const challengeId = event.params.challengeId; // REMOVED: Unused variable
    const enrollmentId = event.params.enrollmentId;
    if (!enrollment || !enrollment.userId) { return; }

    const userId = enrollment.userId;

    // Fetch user's sleep time for scheduling (simplistic for now, assuming a default or configured value)
    const clientDoc = await db.collection('clients').doc(userId).get();
    const clientData = clientDoc.data();
    // Assuming sleepTimeMillis is stored directly or derived. For this example, let's use a fixed time for demonstration.
    // In a real app, this would be dynamic per user.
    const userSleepHour = clientData?.sleepTimeHour || 22; // Default to 10 PM
    const userSleepMinute = clientData?.sleepTimeMinute || 0;

    const now = new Date();
    let checkinTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), userSleepHour, userSleepMinute, 0);
    checkinTime = new Date(checkinTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before sleep

    // If checkinTime is in the past for today, schedule for tomorrow
    if (checkinTime < now) {
        checkinTime.setDate(checkinTime.getDate() + 1);
    }

    const queue = getFunctions().taskQueue('challengeCheckinHandler');
    try {
        // Schedule a task for challenge check-in. For recurring, a more complex cron-like setup would be needed.
        // For now, schedule for the next opportune time.
        await queue.enqueue({ userId, challengeId: enrollmentId }, { scheduleTime: checkinTime });
        console.log(`Scheduled initial challenge check-in for user ${userId} at ${checkinTime.toISOString()}`);
    } catch (error) {
        console.error(`Error scheduling challenge check-in for user ${userId}:`, error);
    }
});


// --- Streak Congrats Notification (Phase 2, Step 2.4) ---

export const onStreakAchieved = onDocumentUpdated("clients/{userId}", async (event) => {
    if (!event.data) { return; }
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = event.params.userId;

    // Assuming a 'currentStreak' field on the client document
    const previousStreak = beforeData?.currentStreak || 0;
    const currentStreak = afterData?.currentStreak || 0;

    if (currentStreak > previousStreak) {
        // Only trigger for significant milestones or any increase if desired
        // For simplicity, let's trigger for any increase for now.
        // You could add conditions here: if (currentStreak % 7 === 0 || currentStreak === 30) { ... }

        const title = '🎉 Streak Achieved!';
        const message = `Congratulations on your ${currentStreak}-day streak! Keep up the great work.`;
        const ctaUrl = `/client/dashboard?notificationType=streak_congrats&openChallengeList=true&isCoach=false`;
        const streakId = `streak-${userId}-${currentStreak}`; // Unique ID for this streak milestone

        await createUserNotification(userId, {
            type: 'streak-congrats',
            title: title,
            message: message,
            pillarId: 'challenges', // Assuming challenges is the pillar for streaks
            entityId: streakId,
            deliverAt: Timestamp.now(), // Immediate delivery
            url: ctaUrl,
            isCoach: String(false), // Streaks are client-facing
            appointmentStartTimeMillis: undefined,
        });
        console.log(`Streak congrats notification sent to user ${userId} for ${currentStreak}-day streak.`);
    }
});
