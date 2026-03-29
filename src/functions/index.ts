'use strict';
// import { initializeApp } from 'firebase-admin/app'; // Removed, Admin SDK initialized via firebaseAdmin.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';
// SURGICAL FIX: Removed the toxic import below that was breaking the Cloud Functions build
// import { createUserNotification } from '../services/reminders'; 
import { admin } from '../lib/firebaseAdmin'; 

// initializeApp(); // Removed, Admin SDK initialized via firebaseAdmin.ts
const db = getFirestore(admin.app()); // MODIFIED: Use globally initialized app instance
const messaging = getMessaging(admin.app()); // MODIFIED: Use globally initialized app instance

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

    let channelId: string;
    if (notificationType === 'chat') {
        channelId = 'chat_messages';
    } else if (notificationType === 'appointment_booked') {
        channelId = 'appointment_booked_notifications';
    } else if (notificationType === 'appointment_reminder') {
        channelId = 'appointment_reminders';
    } else if (notificationType === 'workout_reminder') {
        channelId = 'workout_reminders';
    } else if (notificationType === 'hydration') {
        channelId = 'hydration_reminders';
    } else if (notificationType === 'custom-popup') { 
        channelId = 'custom_popups'; 
    } else if (notificationType.includes('indulgence_')) {
        channelId = 'indulgence_notifications';
    } else if (notificationType === 'challenge_checkin') {
        channelId = 'challenge_notifications';
    } else if (notificationType === 'streak_congrats') {
        channelId = 'streak_notifications';
    }
    else {
        channelId = 'default';
    }

    const rawDataPayload: { [key: string]: any } = {
        title: title,
        body: message,
        url: ctaUrl,
        notificationType: notificationType,
        entityId: entityId,
        isCoach: isCoachParam,
    };

    if (senderId) rawDataPayload.senderId = senderId;
    if (senderName) rawDataPayload.senderName = senderName;
    if (messageText) rawDataPayload.messageText = messageText;
    if (imageUrl) rawDataPayload.imageUrl = imageUrl;
    if (appointmentStartTimeMillis) rawDataPayload.appointmentStartTimeMillis = appointmentStartTimeMillis;

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
        if (appointmentStartTimeMillis) rawDataPayload.indulgenceStartTimeMillis = appointmentStartTimeMillis;
    } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType)) {
        rawDataPayload.challengeId = entityId;
        rawDataPayload.openChallengeList = 'true';
    }

    const dataPayload: { [key: string]: string } = Object.keys(rawDataPayload).reduce((acc, key) => {
        if (rawDataPayload[key] !== undefined) {
            acc[key] = String(rawDataPayload[key]);
        }
        return acc;
    }, {} as { [key: string]: string });

    const notificationPayload: { [key: string]: any } = {
        title: String(title),
        body: String(message),
        imageUrl: imageUrl,
    };

    if (['appointment_booked_notifications', 'appointment_reminders', 'workout_reminders', 'hydration_reminders', 'custom_popups', 'indulgence_notifications', 'challenge_notifications', 'streak_notifications'].includes(channelId)) {
        notificationPayload.android_channel_id = String(channelId);
    }

    const payload: MulticastMessage = {
        tokens: tokens,
        notification: notificationPayload as any,
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
            },
        },
    };

    try {
        const response = await messaging.sendEachForMulticast(payload);
        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(tokens[idx]);
                    }
                }
            });
            if (tokensToRemove.length > 0) {
                const currentTokens = userDocRef.data()?.fcmTokens || [];
                const updatedTokens = currentTokens.filter((token: string) => !tokensToRemove.includes(token));
                await db.collection('clients').doc(userId).update({ fcmTokens: updatedTokens });
            }
        }
    } catch (error) {
        console.error(`Catastrophic error sending notification to user ${userId}:`, error);
    }
}

export const onNotificationCreated = onDocumentCreated("clients/{userId}/notifications/{notificationId}", async (event) => {
    if (!event.data) { return; }
    const notification = event.data.data();
    const userId = event.params.userId;

    const deliverAt = (notification.deliverAt as Timestamp).toDate();
    const now = new Date();

    const payload = {
        userId,
        title: notification.title,
        message: notification.message,
        ctaUrl: notification.url,
        notificationType: notification.type,
        entityId: notification.entityId,
        imageUrl: notification.data?.imageUrl,
        isCoachParam: notification.isCoach,
        appointmentStartTimeMillis: notification.appointmentStartTimeMillis,
    };

    if (deliverAt <= now) {
        await sendPushNotification(
            payload.userId,
            payload.title,
            payload.message,
            payload.ctaUrl,
            payload.notificationType,
            payload.entityId,
            payload.imageUrl,
            undefined, 
            undefined, 
            payload.message,
            payload.appointmentStartTimeMillis,
            payload.isCoachParam
        );
    } else {
        const queue = getFunctions().taskQueue('scheduledNotificationHandler');
        await queue.enqueue(payload, { scheduleTime: deliverAt });
    }
});

export const scheduledNotificationHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, title, message, ctaUrl, notificationType, entityId, imageUrl, isCoachParam, appointmentStartTimeMillis } = req.data;
    await sendPushNotification(
        userId,
        title,
        message,
        ctaUrl,
        notificationType,
        entityId,
        imageUrl,
        undefined,
        undefined,
        message,
        appointmentStartTimeMillis,
        isCoachParam
    );
});

export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) { return; }
    const message = event.data.data();
    if (!message || message.userId === 'system') { return; }

    const chatId = event.params.chatId;
    const senderId = message.userId;
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
        await sendPushNotification(userId, 'Test Notification', 'This is a test message.', '/client/dashboard?notificationType=test', 'test', 'test-id', undefined, undefined, undefined, 'This is a test message.', undefined, String(false));
        res.status(200).send("Notification sent.");
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
    await sendPushNotification(userId, title, message, ctaUrl, 'appointment_reminder', appointmentId, undefined, undefined, undefined, message, Number(appointmentStartTimeMillis), String(isCoach));
});

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) { return; }
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !event.data.createTime || !appointment.start) { return; }
    const reminderTime = new Date(appointment.start.toMillis() - 10 * 60 * 1000);
    const queue = getFunctions().taskQueue('appointmentReminderHandler');
    if (appointment.type === 'one_on_one') {
        const { clientId, coachId } = appointment;
        const tasks: Promise<any>[] = [];
        if (clientId) {
            tasks.push(queue.enqueue({ userId: clientId, appointmentId, isCoach: false, opponentName: 'your coach', appointmentStartTimeMillis: appointment.start.toMillis() }, { scheduleTime: reminderTime }));
        }
        if (coachId) {
            tasks.push(queue.enqueue({ userId: coachId, appointmentId, isCoach: true, opponentName: 'your client', appointmentStartTimeMillis: appointment.start.toMillis() }, { scheduleTime: reminderTime }));
        }
        try {
            await Promise.all(tasks);
        } catch (error) {
            console.error(`Error enqueuing one-on-one appointment tasks for appointment ${appointmentId}:`, error);
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
            console.error(`Error enqueuing live event tasks for appointment ${appointmentId}:`, error);
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
    await sendPushNotification(userId, '💧 Time to Hydrate!', message, ctaUrl, 'hydration', 'hydration', iconUrl, undefined, undefined, message, undefined, String(false));
    await docRef.update({ status: 'sent' });
    if (reminder.isRecurring) {
        const nextScheduledAt = new Date(scheduledTime.getTime());
        nextScheduledAt.setDate(nextScheduledAt.getDate() + 1);
        await db.collection('reminders').add({ ...reminder, scheduledAt: nextScheduledAt, status: 'scheduled', createdAt: new Date() });
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
        console.error(`Error enqueuing task for reminder ${reminderId}:`, error);
    }
});

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
        default: return;
    }
    await sendPushNotification(userId, title, message, ctaUrl, type, indulgenceId, undefined, undefined, undefined, message, relevantTimeMillis, String(false));
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
    const prepTime = new Date(indulgenceStartTimeMillis - 12 * 60 * 60 * 1000);
    if (prepTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_prep', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: prepTime }));
    }
    const checkinTime = new Date(indulgenceStartTimeMillis - 2 * 60 * 60 * 1000);
    if (checkinTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_checkin', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: checkinTime }));
    }
    const recoverTime = new Date(indulgenceEndTimeMillis + 8 * 60 * 60 * 1000);
    if (recoverTime > new Date()) {
        tasks.push(queue.enqueue({ userId, indulgenceId, type: 'indulgence_recover', indulgenceStartTimeMillis, indulgenceEndTimeMillis }, { scheduleTime: recoverTime }));
    }
    try {
        await Promise.all(tasks);
    } catch (error) {
        console.error(`Error scheduling indulgence reminders for plan ${indulgenceId}:`, error);
    }
});

export const challengeCheckinHandler = onTaskDispatched<any>({}, async (req) => {
    const { userId, challengeId } = req.data;
    const title = 'Challenge Check-in';
    const message = 'Don\'t forget to check in on your challenge progress today!';
    const ctaUrl = `/client/dashboard?notificationType=challenge_checkin&openChallengeList=true&isCoach=false`;
    await sendPushNotification(userId, title, message, ctaUrl, 'challenge_checkin', challengeId, undefined, undefined, undefined, message, undefined, String(false));
});

export const onChallengeEnrollmentCreated = onDocumentCreated("challenges/{challengeId}/enrollments/{enrollmentId}", async (event) => {
    if (!event.data) { return; }
    const enrollment = event.data.data();
    const enrollmentId = event.params.enrollmentId;
    if (!enrollment || !enrollment.userId) { return; }
    const userId = enrollment.userId;
    const clientDoc = await db.collection('clients').doc(userId).get();
    const clientData = clientDoc.data();
    const userSleepHour = clientData?.sleepTimeHour || 22;
    const userSleepMinute = clientData?.sleepTimeMinute || 0;
    const now = new Date();
    let checkinTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), userSleepHour, userSleepMinute, 0);
    checkinTime = new Date(checkinTime.getTime() - 2 * 60 * 60 * 1000);
    if (checkinTime < now) {
        checkinTime.setDate(checkinTime.getDate() + 1);
    }
    const queue = getFunctions().taskQueue('challengeCheckinHandler');
    try {
        await queue.enqueue({ userId, challengeId: enrollmentId }, { scheduleTime: checkinTime });
    } catch (error) {
        console.error(`Error scheduling challenge check-in for user ${userId}:`, error);
    }
});

export const onStreakAchieved = onDocumentUpdated("clients/{userId}", async (event) => {
    if (!event.data) { return; }
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = event.params.userId;
    const previousStreak = beforeData?.currentStreak || 0;
    const currentStreak = afterData?.currentStreak || 0;
    if (currentStreak > previousStreak) {
        const title = '🎉 Streak Achieved!';
        const message = `Congratulations on your ${currentStreak}-day streak! Keep up the great work.`;
        const ctaUrl = `/client/dashboard?notificationType=streak_congrats&openChallengeList=true&isCoach=false`;
        const streakId = `streak-${userId}-${currentStreak}`;
        
        // SURGICAL FIX: Inlined logic from createUserNotification
        const reminderPayload = {
            type: 'streak-congrats',
            title: title,
            message: message,
            pillarId: 'challenges',
            entityId: streakId,
            deliverAt: Timestamp.now(),
            url: ctaUrl,
            isCoach: String(false),
            appointmentStartTimeMillis: undefined,
        };
        const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
        await notificationRef.set({
            ...reminderPayload,
            createdAt: Timestamp.now(),
            seen: false,
        });
        console.log(`Streak congrats notification document created for user ${userId} for ${currentStreak}-day streak.`);
    }
});
