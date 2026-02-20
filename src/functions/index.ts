
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// -----------------------------------------------------------------------------
// PART A: THE TRIGGER (FOR REAL-TIME CHAT NOTIFICATIONS)
// -----------------------------------------------------------------------------
export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log("No message data found.");
        return;
    }

    const chatId = event.params.chatId;
    const userId = message.userId;
    const messageText = message.text || 'You received a new message';

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
        console.log(`Chat document ${chatId} not found.`);
        return;
    }
    const participants = chatDoc.data()?.participants || [];
    const recipients = participants.filter((p: string) => p !== userId);

    if (recipients.length === 0) {
        console.log("No recipients to notify.");
        return;
    }

    const senderProfileRef = db.collection('clients').doc(userId);
    const senderProfileDoc = await senderProfileRef.get();
    const senderName = senderProfileDoc.data()?.name || 'New Message';

    const promises = recipients.map((recipientId: string) => {
        const notificationData = {
            userId: recipientId,
            title: senderName,
            message: messageText.substring(0, 100),
            ctaUrl: `/client/dashboard?notificationType=chat&entityId=${chatId}`,
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
// PART B: THE ENGINE (SENDS ALL PUSH NOTIFICATIONS)
// -----------------------------------------------------------------------------

async function sendPushNotification(userId: string, title: string, message: string, ctaUrl?: string, notificationType?: string, entityId?: string) {
  const userRef = db.collection('clients').doc(userId);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const userData = userDoc.data();
    if (userData && userData.fcmTokens && userData.fcmTokens.length > 0) {
      const tokens = userData.fcmTokens.filter((t: any) => t);

      if (tokens.length === 0) {
        return;
      }
      
      const payload = {
        tokens: tokens,
        data: {
            title: title,
            body: message,
            ctaUrl: ctaUrl || '/',
            notificationType: notificationType || 'general',
            entityId: entityId || 'none',
        },
        notification: {
            title: title,
            body: message,
        },
        webpush: {
            fcmOptions: {
                link: ctaUrl || '/',
            },
            notification: {
                icon: '/icon.png',
            }
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: title,
                body: message,
                channelId: 'default_notification_channel',
                icon: 'ic_notification',
            },
        },
        apns: {
            payload: {
                aps: {
                    alert: {
                        title: title,
                        body: message,
                    },
                    'content-available': 1,
                    sound: 'default',
                },
            },
            headers: {
                'apns-priority': '10',
            },
        },
      };

      try {
        await messaging.sendEachForMulticast(payload as any);
        console.log(`Successfully sent notification to user ${userId}`);
      } catch (error) {
        console.error(`Error sending push notification to user ${userId}:`, error);
      }
    }
  }
}

export const unifiedNotificationEngine = onSchedule('every 1 minutes', async (event) => {
  const now = Timestamp.now();
  
  const query = db.collection('notifications')
                  .where('processed', '==', false)
                  .where('sendTime', '<=', now);
  
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    return;
  }

  console.log(`Found ${snapshot.docs.length} notifications to process.`);

  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    
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

export { saveFcmToken } from './saveFcmToken';
