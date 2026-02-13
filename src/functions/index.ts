import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin SDK
try {
  initializeApp();
} catch (e) {
  console.log("Admin SDK already initialized or running in emulator.");
}

const db = getFirestore();
const messaging = getMessaging();

/**
 * =========================================================================================
 *                              THE UNIFIED NOTIFICATION ENGINE
 * =========================================================================================
 * This is the single, centralized engine for ALL scheduled notifications in the app.
 * It runs every minute, checks for any due notifications, sends them as real push
 * notifications, and handles recurring schedules.
 */
export const unifiedNotificationEngine = onSchedule("every 1 minutes", async (event) => {
  console.log("Unified Notification Engine: Starting run...");
  const now = Timestamp.now();
  const notificationsToSend = await db.collection("notifications")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", now)
    .get();

  if (notificationsToSend.empty) {
    console.log("Unified Notification Engine: No notifications due at this time.");
    return;
  }

  console.log(`Unified Notification Engine: Found ${notificationsToSend.docs.length} notifications to process.`);

  const batch = db.batch();
  const promises: Promise<any>[] = [];

  for (const doc of notificationsToSend.docs) {
    const notification = doc.data();
    const notificationId = doc.id;

    // 1. SEND THE PUSH NOTIFICATION
    const sendPromise = sendPushNotification(notification);
    promises.push(sendPromise);

    // 2. UPDATE THE NOTIFICATION'S STATUS
    // If it's a recurring notification, schedule the next one. Otherwise, mark as sent.
    if (notification.recurring && notification.recurringPattern) {
        const nextScheduledAt = calculateNextOccurrence(notification.scheduledAt, notification.recurringPattern);
        batch.update(doc.ref, {
            status: "scheduled", // It remains scheduled for the next time
            scheduledAt: nextScheduledAt
        });
        console.log(`Re-scheduling recurring notification ${notificationId} for ${nextScheduledAt.toDate()}`);
    } else {
        batch.update(doc.ref, { status: "sent" });
        console.log(`Marking non-recurring notification ${notificationId} as sent.`);
    }
  }

  // 3. COMMIT BATCH & AWAIT PUSHES
  await Promise.all([batch.commit(), ...promises]);
  console.log("Unified Notification Engine: Run completed successfully.");
});


/**
 * Sends a push notification to a user's device(s).
 * @param notification The notification data from Firestore.
 */
async function sendPushNotification(notification: any): Promise<void> {
  const { userId, title, message, ctaUrl } = notification;

  const userProfileDoc = await db.collection("userProfiles").doc(userId).get();
  
  if (!userProfileDoc.exists) {
    console.log(`User profile not found for user ${userId}. Cannot send notification.`);
    return;
  }
  
  const userProfileData = userProfileDoc.data();
  const tokens = userProfileData?.fcmTokens;

  if (!tokens || tokens.length === 0) {
    console.log(`No push tokens found for user ${userId}. Cannot send notification.`);
    return;
  }

  // ** CORRECTED PAYLOAD STRUCTURE **
  const payload = {
    tokens: tokens,
    data: {
      title: title,
      body: message,
      ...(ctaUrl && { ctaUrl: ctaUrl })
    },
    android: {
        priority: "high" as const,
        notification: {
            channelId: "default_notification_channel"
        }
    },
    apns: {
        payload: {
            aps: {
                'content-available': 1
            }
        },
        headers: {
            'apns-priority': '10'
        }
    }
  };

  try {
    const response = await messaging.sendEachForMulticast(payload as any);
    console.log(`Successfully sent push notification to ${response.successCount} tokens for user ${userId}.`);
    if (response.failureCount > 0) {
      console.warn(`Failed to send to ${response.failureCount} tokens for user ${userId}.`);
    }
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
  }
}

/**
 * Calculates the next occurrence for a recurring notification.
 * Currently supports daily recurrence.
 * @param lastScheduledAt The timestamp of the last time it was scheduled.
 * @param pattern The recurring pattern.
 * @returns The timestamp for the next occurrence.
 */
function calculateNextOccurrence(lastScheduledAt: Timestamp, pattern: any): Timestamp {
    const lastDate = lastScheduledAt.toDate();
    if (pattern.interval === 'daily') {
        const nextDate = new Date(lastDate.getTime());
        nextDate.setDate(lastDate.getDate() + 1);
        return Timestamp.fromDate(nextDate);
    }
    return Timestamp.fromMillis(lastScheduledAt.toMillis() + 24 * 60 * 60 * 1000);
}

// Export the test notification function for debugging and development
export { sendTestNotification } from "./test-notifications";
