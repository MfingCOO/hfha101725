'use strict';
// import { initializeApp } from 'firebase-admin/app'; // Removed, Admin SDK initialized via firebaseAdmin.ts
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';
import { admin } from '../lib/firebaseAdmin';
import { formatInTimeZone } from 'date-fns-tz';

const db = getFirestore(admin.app());
const messaging = getMessaging(admin.app());

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
    
    const payload: MulticastMessage = {
        tokens: tokens,
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
        await messaging.sendEachForMulticast(payload);
        console.log(`[sendPushNotification] Successfully sent notification of type '${notificationType}' to user ${userId}.`);
    } catch (error) {
        console.error(`[sendPushNotification] Catastrophic error sending notification to user ${userId}:`, error);
    }
}

// THIS FUNCTION IS THE ROOT CAUSE OF THE FAILURES. IT IS NO LONGER USED.
// export const onNotificationCreated = onDocumentCreated("clients/{userId}/notifications/{notificationId}", async (event) => {});

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

export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) { return; }
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !event.data.createTime || !appointment.start) { return; }

    const { clientId, coachId, clientName, coachName, clientTimezone } = appointment;

    const isAppointment = coachId && clientId;

    if (isAppointment) {
        try {
            const appointmentStartTime = (appointment.start as Timestamp).toDate();
            const finalTimezone = clientTimezone || 'UTC';
            const formattedStartTime = formatInTimeZone(appointmentStartTime, finalTimezone, 'PPP p');
            
            const resolvedClientName = clientName || await getUserName(clientId) || 'a client';
            const resolvedCoachName = coachName || await getUserName(coachId) || 'your coach';
            
            const ctaUrlCoach = `/coach/dashboard?notificationType=appointment_booked&openAppointmentId=${appointmentId}&isCoach=true`;
            const ctaUrlClient = `/client/dashboard?notificationType=appointment_booked&openAppointmentId=${appointmentId}&isCoach=false`;

            // --- DIRECT SEND FOR 'APPOINTMENT_BOOKED' NOTIFICATIONS ---
            const coachMsg = `${resolvedClientName} has booked a call with you for ${formattedStartTime}`;
            await sendPushNotification(coachId, 'New Appointment Booked', coachMsg, ctaUrlCoach, 'appointment_booked', appointmentId, undefined, undefined, undefined, coachMsg, appointmentStartTime.getTime(), String(true));
            
            const clientMsg = `Your appointment with ${resolvedCoachName} for ${formattedStartTime} is confirmed.`;
            await sendPushNotification(clientId, 'Appointment Confirmed', clientMsg, ctaUrlClient, 'appointment_booked', appointmentId, undefined, undefined, undefined, clientMsg, appointmentStartTime.getTime(), String(false));

            // --- DIRECT TASK ENQUEUE FOR 'APPOINTMENT_REMINDER' ---
            const reminderTime = new Date(appointment.start.toMillis() - 10 * 60 * 1000);
            if (reminderTime > new Date()) {
                const queue = getFunctions().taskQueue('scheduledNotificationHandler');

                const coachReminderPayload = {
                    userId: coachId,
                    title: 'Upcoming Appointment',
                    message: `Your appointment with ${resolvedClientName} is in 10 minutes.`,
                    ctaUrl: ctaUrlCoach,
                    notificationType: 'appointment_reminder',
                    entityId: appointmentId,
                    isCoachParam: String(true),
                    appointmentStartTimeMillis: appointmentStartTime.getTime(),
                };
                await queue.enqueue(coachReminderPayload, { scheduleTime: reminderTime });
                
                const clientReminderPayload = {
                    userId: clientId,
                    title: 'Upcoming Appointment',
                    message: `Your appointment with ${resolvedCoachName} is in 10 minutes.`,
                    ctaUrl: ctaUrlClient,
                    notificationType: 'appointment_reminder',
                    entityId: appointmentId,
                    isCoachParam: String(false),
                    appointmentStartTimeMillis: appointmentStartTime.getTime(),
                };
                await queue.enqueue(clientReminderPayload, { scheduleTime: reminderTime });
            }
        } catch (e) {
            console.error(`[onAppointmentScheduled] Failed to send appointment notifications for ${appointmentId}`, e);
        }
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

        // --- DIRECT SEND FOR 'STREAK_CONGRATS' NOTIFICATION ---
        await sendPushNotification(userId, title, message, ctaUrl, 'streak-congrats', streakId, undefined, undefined, undefined, message, undefined, String(false));
    }
});

// All functions below already use the correct direct-send or task-queue pattern. No changes needed.
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
    const message = "Don't forget to check in on your challenge progress today!";
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

// Adding a test function for immediate testing if needed.
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
