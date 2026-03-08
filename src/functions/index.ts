'use strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Helper to get a user's name from the 'clients' collection
const getUserName = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
        const clientDoc = await db.collection('clients').doc(userId).get();
        if (clientDoc.exists && clientDoc.data()?.fullName) {
            return clientDoc.data()?.fullName as string;
        }
    } catch (error) {
         console.error(`Error fetching user name for ${userId} from \'clients\':`, error);
    }
    console.log(`getUserName: Could not find a name for userId: ${userId} in \'clients\' collection.`);
    return null;
};

// Helper to check if a user is a coach by checking the 'role' field in the 'clients' collection
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

// --- Universal Push Notification Sender ---
async function sendPushNotification(userId: string, title: string, message: string, ctaUrl: string, notificationType: string, entityId: string, imageUrl?: string) {
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

    const payload = {
        tokens: tokens,
        data: {
            title,
            body: message,
            url: ctaUrl,
            notificationType,
            entityId,
            ...(imageUrl && { imageUrl }),
        },
        apns: {
            payload: {
                aps: {
                    alert: { title, body: message },
                    badge: 1,
                    sound: 'default',
                    'mutable-content': 1,
                },
            },
            fcm_options: {
                image: imageUrl,
            },
        },
        android: {
            priority: 'high' as const,
            notification: {
                title,
                body: message,
                channelId,
                imageUrl,
                sound: 'default',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
        },
    };

    try {
        const response = await messaging.sendEachForMulticast(payload as any);
        console.log(`FCM Response for ${userId}. Success: ${response.successCount}, Failure: ${response.failureCount}`);

        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
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

// [NOW INSTANT] onNewMessage sends notifications directly, not to the queue.
export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    if (!event.data) {
        console.log("onNewMessage: No data associated with the event. Exiting.");
        return;
    }
    const message = event.data.data();
    if (!message) {
        console.log("onNewMessage: No message data found. Exiting.");
        return;
    }

    const chatId = event.params.chatId;
    const senderId = message.userId;

    if (senderId === 'system') {
        console.log("onNewMessage: Ignoring system message. Exiting.");
        return;
    }

    const messageText = message.text || (message.fileUrl ? 'You received a new attachment' : '[Empty Message]');
    const imageUrl = message.fileUrl || null;

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
        console.log(`onNewMessage: Chat document ${chatId} not found. Exiting.`);
        return;
    }

    const chatData = chatDoc.data()!;
    const participants = chatData.participants || [];
    const recipients = participants.filter((p: string) => p !== senderId && !(chatData.mutedBy && chatData.mutedBy.includes(p)));

    if (recipients.length === 0) {
        console.log("onNewMessage: No recipients to notify (or all are muted). Exiting.");
        return;
    }

    const senderName = await getUserName(senderId);
    const body = messageText.substring(0, 100);
    let title = `New message from ${senderName || 'Someone'}`;

    if (chatData.type === 'private_group' || chatData.type === 'open') {
        title = `New message in ${chatData.name || 'your group chat'}`;
    }

    const promises = recipients.map(async (recipientId: string) => {
        const isRecipientCoach = await isUserCoach(recipientId);
        const dashboardUrl = isRecipientCoach ? '/coach/chats' : '/chats';
        const ctaUrl = `${dashboardUrl}?chatId=${String(chatId)}`;

        // Directly send the push notification instead of queueing it.
        return sendPushNotification(
            recipientId,
            title,
            body,
            ctaUrl,
            'chat',
            String(chatId),
            imageUrl || undefined
        );
    });

    await Promise.all(promises);
    console.log(`onNewMessage: Instantly sent ${recipients.length} chat notifications.`);
});


// Diagnostic test function
export const testPushNotification = onRequest(async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
        res.status(400).send("Please provide a userId in the query string, e.g., ?userId=some-user-id");
        return;
    }
    console.log(`testPushNotification: Attempting to send a test notification to userId: ${userId}`);
    try {
        await sendPushNotification(
            userId,
            'Test Notification',
            'This is a test message to verify push notifications are working.',
            '/client/dashboard',
            'test',
            'test-id'
        );
        console.log(`testPushNotification: Successfully invoked sendPushNotification for ${userId}. Check client device.`);
        res.send(`Successfully triggered a test notification for user ${userId}. Check the device and function logs.`);
    } catch (error) {
        console.error(`testPushNotification: Failed to send notification to ${userId}:`, error);
        res.status(500).send(`Failed to send notification to ${userId}. Check function logs for details.`);
    }
});

// Workout Reminder Handler
export const workoutReminderHandler = onTaskDispatched<any>({ /* Task options */ }, async (req) => {
    const { userId, workoutId, workoutName } = req.data;
    console.log(`workoutReminderHandler: Received task for userId: ${userId}, workoutId: ${workoutId}`);
    try {
        const docRef = db.collection('scheduledWorkouts').doc(workoutId);
        const doc = await docRef.get();
        if (doc.exists && doc.data()?.status === 'reminder_sent') {
            console.log(`workoutReminderHandler: Reminder already sent for workout ${workoutId}. Aborting.`);
            return;
        }
        await sendPushNotification(
            userId,
            'Workout Reminder',
            `Your scheduled workout, "${workoutName}," is in 10 minutes!`,
            `/client/dashboard?notificationType=workout_reminder&entityId=${String(workoutId)}`,
            'workout_reminder',
            String(workoutId)
        );
        await docRef.update({ status: 'reminder_sent' });
        console.log(`workoutReminderHandler: Successfully sent reminder for workout ${workoutId}`);
    } catch (error) {
        console.error(`workoutReminderHandler: Error processing task for workout ${workoutId}:`, error);
        throw error;
    }
});

// onWorkoutScheduled trigger
export const onWorkoutScheduled = onDocumentCreated("scheduledWorkouts/{workoutId}", async (event) => {
    if (!event.data) {
        console.log(`onWorkoutScheduled: No data associated with the event. Skipping.`);
        return;
    }
    const workout = event.data.data();
    const workoutId = event.params.workoutId;
    if (!workout || !event.data.createTime || workout.status !== 'scheduled') {
        console.log(`onWorkoutScheduled: Skipping workout ${workoutId}. Not a new 'scheduled' workout.`);
        return;
    }
    const { userId, workoutName, scheduledDate } = workout;
    const reminderTime = new Date(scheduledDate.toMillis() - 10 * 60 * 1000);
    if (reminderTime < new Date()) {
        console.log(`onWorkoutScheduled: Reminder time for workout ${workoutId} is in the past. Skipping.`);
        return;
    }
    const queue = getFunctions().taskQueue('workoutReminderHandler', 'us-central1');
    try {
        await queue.enqueue(
            { userId, workoutId, workoutName },
            { scheduleTime: reminderTime }
        );
        console.log(`onWorkoutScheduled: Enqueued reminder for workout ${workoutId} to run at ${reminderTime.toISOString()}`);
    } catch (error) {
        console.error(`onWorkoutScheduled: Error enqueuing task for workout ${workoutId}:`, error);
    }
});

// Appointment Reminder Handler
export const appointmentReminderHandler = onTaskDispatched<any>({/* Task options */}, async (req) => {
    const { userId, appointmentId, isCoach, opponentName, eventTitle } = req.data;
    console.log(`appointmentReminderHandler: Received task for userId: ${userId}, appointmentId: ${appointmentId}`);
    try {
        let title = 'Upcoming Appointment';
        let message = `Your appointment with ${opponentName || 'your coach/client'} is in 10 minutes.`;
        if (eventTitle) {
            title = 'Live Event Starting Soon';
            message = `The event "${eventTitle}" is starting in 10 minutes!`;
        }
        const dashboardUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';
        const ctaUrl = `${dashboardUrl}?notificationType=appointment_reminder&entityId=${appointmentId}`;

        await sendPushNotification(
            userId,
            title,
            message,
            ctaUrl,
            'appointment_reminder',
            appointmentId
        );
        console.log(`appointmentReminderHandler: Successfully sent reminder to ${userId} for appointment ${appointmentId}`);
    } catch (error) {
        console.error(`appointmentReminderHandler: Error processing task for appointment ${appointmentId}:`, error);
        throw error;
    }
});

// onAppointmentScheduled trigger
export const onAppointmentScheduled = onDocumentCreated("coachCalendar/{appointmentId}", async (event) => {
    if (!event.data) {
        console.log(`onAppointmentScheduled: No data associated with the event. Skipping.`);
        return;
    }
    const appointment = event.data.data();
    const appointmentId = event.params.appointmentId;
    if (!appointment || !event.data.createTime || !appointment.start) {
        console.log(`onAppointmentScheduled: Skipping appointment ${appointmentId}. Not a new appointment or no start time.`);
        return;
    }
    const reminderTime = new Date(appointment.start.toMillis() - 10 * 60 * 1000);
    if (reminderTime < new Date()) {
        console.log(`onAppointmentScheduled: Reminder time for appointment ${appointmentId} is in the past. Skipping.`);
        return;
    }
    const queue = getFunctions().taskQueue('appointmentReminderHandler', 'us-central1');
    if (appointment.type === 'one_on_one') {
        const { clientId, coachId } = appointment;
        const clientName = await getUserName(clientId);
        const coachName = await getUserName(coachId);
        const tasks: Promise<void>[] = [];
        if (clientId) {
            tasks.push(queue.enqueue({ userId: clientId, appointmentId, isCoach: false, opponentName: coachName || 'your coach' }, { scheduleTime: reminderTime }));
        }
        if (coachId) {
            tasks.push(queue.enqueue({ userId: coachId, appointmentId, isCoach: true, opponentName: clientName || 'your client' }, { scheduleTime: reminderTime }));
        }
        await Promise.all(tasks);
        console.log(`onAppointmentScheduled: Enqueued reminders for one-on-one appointment ${appointmentId}`);
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
        console.log(`onAppointmentScheduled: Enqueued ${attendees.length} reminders for live event ${appointment.liveEventId}`);
    }
});

// Hydration Reminder Engine - USES THE QUEUE
export const hydrationReminderEngine = onSchedule('every 15 minutes', async (event) => {
    const now = Timestamp.now();
    const query = db.collection('reminders').where('status', '==', 'scheduled').where('scheduledAt', '<=', now);
    const snapshot = await query.get();
    if (snapshot.empty) return;

    const promises = snapshot.docs.map(async (doc: QueryDocumentSnapshot) => {
        const reminder = doc.data();
        const userId = reminder.userId;
        const notificationData = {
            userId: userId,
            title: '💧 Time to Hydrate!',
            message: 'A quick reminder to drink some water and log your intake.',
            ctaUrl: `/client/dashboard?notificationType=hydration`,
            notificationType: 'hydration',
            entityId: 'hydration',
            sendTime: now, // Add to queue for immediate processing
            processed: false,
        };
        await db.collection('notifications').add(notificationData);
    });
    await Promise.all(promises);
});

// Unified Notification Engine - PROCESSES THE QUEUE (Reminders Only)
export const unifiedNotificationEngine = onSchedule('every 5 minutes', async (event) => {
  const now = Timestamp.now();
  const query = db.collection('notifications').where('processed', '==', false).where('sendTime', '<=', now);
  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log("unifiedNotificationEngine: No notifications to process.");
    return;
  }

  console.log(`unifiedNotificationEngine: Found ${snapshot.docs.length} notifications to process.`);

  const promises = snapshot.docs.map(async (doc: QueryDocumentSnapshot) => {
    const notification = doc.data();
    await doc.ref.update({ processed: true });
    await sendPushNotification(
      notification.userId,
      notification.title,
      notification.message,
      notification.ctaUrl,
      notification.notificationType as string,
      notification.entityId as string,
      notification.imageUrl as string | undefined
    );
  });
  await Promise.all(promises);
  console.log(`unifiedNotificationEngine: Finished processing ${snapshot.docs.length} notifications.`);
});

// [NEW] Daily cleanup of old, processed notifications from the queue
export const cleanupProcessedNotifications = onSchedule('every 24 hours', async (event) => {
    console.log("Running daily cleanup of processed notifications.");

    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = db.collection('notifications')
                    .where('processed', '==', true)
                    .where('sendTime', '<=', sevenDaysAgo);
                    
    const snapshot = await query.get();

    if (snapshot.empty) {
        console.log("No old processed notifications to clean up.");
        return;
    }

    console.log(`Found ${snapshot.size} old notifications to delete.`);

    // Firestore allows a maximum of 500 operations in a single batch.
    const batches: Promise<any>[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    snapshot.docs.forEach((doc, index) => {
        currentBatch.delete(doc.ref);
        operationCount++;

        // If we reach the batch limit or this is the last document, commit the batch.
        if (operationCount === 500 || index === snapshot.docs.length - 1) {
            batches.push(currentBatch.commit());
            // Start a new batch for the next set of operations.
            currentBatch = db.batch();
            operationCount = 0;
        }
    });

    await Promise.all(batches);

    console.log(`Cleanup complete. Deleted ${snapshot.size} old notifications.`);
});
