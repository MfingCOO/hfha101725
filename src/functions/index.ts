
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// -----------------------------------------------------------------------------
// PART A: THE TRIGGER (This was the missing piece)
// -----------------------------------------------------------------------------
export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log("No message data found.");
        return;
    }

    const chatId = event.params.chatId;
    const senderId = message.authorId;
    const messageText = message.text || 'You received a new message';

    // 1. Get the participants of the chat
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
        console.log(`Chat document ${chatId} not found.`);
        return;
    }
    const participants = chatDoc.data()?.participants || [];
    const recipients = participants.filter((p: string) => p !== senderId);

    if (recipients.length === 0) {
        console.log("No recipients to notify.");
        return;
    }

    // 2. Get the sender's name for the notification title
    const senderProfileRef = db.collection('userProfiles').doc(senderId);
    const senderProfileDoc = await senderProfileRef.get();
    const senderName = senderProfileDoc.data()?.name || 'New Message';

    // 3. Create a notification document for each recipient
    const promises = recipients.map((recipientId: string) => {
        const notificationData = {
            userId: recipientId,
            title: senderName,
            message: messageText.substring(0, 100), // Truncate message for safety
            ctaUrl: `/chat/${chatId}`,
            notificationType: 'chat',
            entityId: chatId,
            sendTime: Timestamp.now(),
            processed: false,
        };
        return db.collection('notifications').add(notificationData);
    });

    await Promise.all(promises);
    console.log(`Created ${recipients.length} notification documents for message in chat ${chatId}.`);
});


// -----------------------------------------------------------------------------
// PART B: THE ENGINE (This part is correct)
// -----------------------------------------------------------------------------

// This function sends the actual push notification payload.
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
      
      const dataPayload: { [key: string]: string } = {
        title: String(title),
        body: String(message),
      };
      if (ctaUrl) dataPayload.ctaUrl = String(ctaUrl);
      if (notificationType) dataPayload.notificationType = String(notificationType);
      if (entityId) dataPayload.entityId = String(entityId);
      
      const androidTitle = (notificationType && entityId)
        ? `[${String(notificationType)}:${String(entityId)}] ${String(title)}`
        : String(title);

      const payload = {
        tokens: tokens,
        data: dataPayload,
        webpush: {
            data: dataPayload,
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: androidTitle,
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

// This scheduled function runs every minute to process the notification queue.
export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  const now = Timestamp.now();
  
  const query = db.collection('notifications')
                  .where('sendTime', '<=', now)
                  .where('processed', '!=', true);
  
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    return;
  }

  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    
    // Mark as processed immediately to prevent duplicate sends in the next run
    await doc.ref.update({ processed: true });
    
    await sendPushNotification(
      notification.userId,
      notification.title,
      notification.message,
      notification.ctaUrl,
      notification.notificationType,
      notification.entityId
    );
  });

  await Promise.all(promises);
});

// This export allows clients to save their FCM token.
export { saveFcmToken } from './saveFcmToken';
