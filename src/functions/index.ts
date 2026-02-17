import { Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db, messaging } from "./firebase";

export const unifiedNotificationEngine = onSchedule("every 1 minutes", async (event) => {
  console.log("Unified Notification Engine: Starting run...");
  const now = Timestamp.now();
  const notificationsToSend = await db.collection("notifications")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", now)
    .get();

  if (notificationsToSend.empty) {
    return;
  }

  const batch = db.batch();
  const promises: Promise<any>[] = [];

  for (const doc of notificationsToSend.docs) {
    const notification = doc.data();

    const sendPromise = sendPushNotification(notification);
    promises.push(sendPromise);

    if (notification.recurring && notification.recurringPattern) {
        const nextScheduledAt = calculateNextOccurrence(notification.scheduledAt, notification.recurringPattern);
        batch.update(doc.ref, {
            status: "scheduled",
            scheduledAt: nextScheduledAt
        });
    } else {
        batch.update(doc.ref, { status: "sent" });
    }
  }

  await Promise.all([batch.commit(), ...promises]);
});

async function sendPushNotification(notification: any): Promise<void> {
  const { userId, title, message, ctaUrl } = notification;

  const userProfileDoc = await db.collection("userProfiles").doc(userId).get();
  if (!userProfileDoc.exists) return;

  const userProfileData = userProfileDoc.data();
  const tokens = userProfileData?.fcmTokens;

  if (!tokens || tokens.length === 0) return;

  const payload = {
    tokens: tokens,
    data: { 
      title: title,
      body: message,
      ...(ctaUrl && { ctaUrl: ctaUrl })
    },
    webpush: {
        data: {
            title: title,
            body: message,
            ...(ctaUrl && { ctaUrl: ctaUrl })
        }
    },
    android: {
        priority: "high" as const,
        notification: {
            title: title,
            body: message,
            channelId: "default_notification_channel"
        }
    },
    apns: {
        payload: {
            aps: {
                alert: {
                    title: title,
                    body: message
                },
                'content-available': 1
            }
        },
        headers: {
            'apns-priority': '10'
        }
    }
  };

  try {
    await messaging.sendEachForMulticast(payload as any);
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
  }
}

function calculateNextOccurrence(lastScheduledAt: Timestamp, pattern: any): Timestamp {
    const lastDate = lastScheduledAt.toDate();
    if (pattern.interval === 'daily') {
        const nextDate = new Date(lastDate.getTime());
        nextDate.setDate(lastDate.getDate() + 1);
        return Timestamp.fromDate(nextDate);
    }
    return Timestamp.fromMillis(lastScheduledAt.toMillis() + 24 * 60 * 60 * 1000);
}

export { saveFcmToken } from './saveFcmToken';
