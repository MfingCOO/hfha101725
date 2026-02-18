import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// A robust, generic function to send notifications.
async function sendPushNotification(userId: string, title: string, message: string, ctaUrl?: string, notificationType?: string, entityId?: string) {
  const userRef = db.collection('userProfiles').doc(userId);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData && userData.fcmTokens && userData.fcmTokens.length > 0) {
      const tokens = userData.fcmTokens.filter((t: any) => t);

      if (tokens.length === 0) {
        console.log(`User ${userId} has no valid FCM tokens.`);
        return;
      }

      // ========================================================
      // == BUG #1 FIX: All data payload values are now STRINGS ==
      // ========================================================
      const dataPayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
      };
      if (ctaUrl) dataPayload.ctaUrl = String(ctaUrl);
      if (notificationType) dataPayload.notificationType = String(notificationType);
      if (entityId) dataPayload.entityId = String(entityId);
      
      const payload = {
        tokens: tokens,
        data: dataPayload,
        webpush: {
            data: dataPayload,
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: String(title),
                body: String(message),
                channelId: 'default_notification_channel',
            },
        },
        apns: {
            payload: {
                aps: {
                    alert: {
                        title: String(title),
                        body: String(message),
                    },
                    'content-available': 1,
                },
            },
            headers: {
                'apns-priority': '10',
            },
        },
      };

      try {
        await messaging.sendEachForMulticast(payload as any);
      } catch (error) {
        console.error(`Error sending push notification to user ${userId}:`, error);
      }
    }
  }
}

// =======================================================================
// == BUG #2 FIX: The engine now ignores already-processed notifications ==
// =======================================================================
export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  console.log('Running unified notification engine...');
  const now = FieldValue.serverTimestamp();
  
  // FIX: Query for notifications that are ready to be sent AND have not been processed yet.
  const query = db.collection('notifications')
                  .where('sendTime', '<=', now)
                  .where('processed', '!=', true);
  
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    console.log('No notifications to send.');
    return;
  }

  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    
    // Send the notification using the generic function
    await sendPushNotification(
      notification.userId,
      notification.title,
      notification.message,
      notification.ctaUrl,
      notification.notificationType,
      notification.entityId
    );
    
    // FIX: Mark the notification as processed to prevent re-sending.
    return doc.ref.update({ processed: true });
  });

  await Promise.all(promises);
  console.log(`Processed ${snapshot.size} notifications.`);
});
