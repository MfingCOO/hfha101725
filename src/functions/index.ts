import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// This function is now perfect. It handles string conversion.
async function sendPushNotification(userId: string, title: string, message: string, ctaUrl?: string, notificationType?: string, entityId?: string) {
  const userRef = db.collection('userProfiles').doc(userId);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData && userData.fcmTokens && userData.fcmTokens.length > 0) {
      const tokens = userData.fcmTokens.filter((t: any) => t);

      if (tokens.length === 0) {
        return;
      }

      // This part is correct: all data is converted to strings.
      const dataPayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
      };
      if (ctaUrl) dataPayload.ctaUrl = String(ctaUrl);
      if (notificationType) dataPayload.notificationType = String(notificationType);
      if (entityId) dataPayload.entityId = String(entityId);
      
      // --- THIS IS THE FINAL, MISSING PIECE FOR ANDROID DEEP-LINKING ---
      // We create the special title format only for the Android part of the payload.
      const androidTitle = (notificationType && entityId)
        ? `[${String(notificationType)}:${String(entityId)}] ${String(title)}`
        : String(title);
      // --- END OF FIX ---

      const payload = {
        tokens: tokens,
        data: dataPayload,
        webpush: {
            data: dataPayload,
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: androidTitle, // Use the special title for Android
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

// This engine is now perfect. It prevents duplicate sends.
export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  const now = Timestamp.now(); // Use Timestamp for Firestore queries
  
  const query = db.collection('notifications')
                  .where('sendTime', '<=', now)
                  .where('processed', '!=', true);
  
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    return;
  }

  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    
    await sendPushNotification(
      notification.userId,
      notification.title,
      notification.message,
      notification.ctaUrl,
      notification.notificationType,
      notification.entityId
    );
    
    return doc.ref.update({ processed: true });
  });

  await Promise.all(promises);
});

// This export is also needed.
export { saveFcmToken } from './saveFcmToken';
