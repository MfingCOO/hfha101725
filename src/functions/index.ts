
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// -----------------------------------------------------------------------------
// PART A: INFORMATIVE NOTIFICATION TRIGGERS
// -----------------------------------------------------------------------------

// --- Function to get a user's name from their user profile ---
const getUserName = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
        const userProfileDoc = await db.collection('userProfiles').doc(userId).get();
        if (userProfileDoc.exists && userProfileDoc.data()?.fullName) {
            return userProfileDoc.data()?.fullName as string;
        }
        console.log(`getUserName: User profile not found or name is missing for userId: ${userId}`);
        return null;
    } catch (error) {
        console.error(`Error fetching user name for userId: ${userId}`, error);
        return null;
    }
};


export const onNewMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log("onNewMessage: No message data found. Exiting.");
        return;
    }

    const chatId = event.params.chatId;
    const senderId = message.userId;
    const messageText = message.text || 'You received a new message';

    console.log(`onNewMessage: Processing new message in chat ${chatId} from sender ${senderId}.`);

    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) {
        console.log(`onNewMessage: Chat document ${chatId} not found. Exiting.`);
        return;
    }
    const chatData = chatDoc.data()!;
    const participants = chatData.participants || [];
    const recipients = participants.filter((p: string) => p !== senderId);

    if (recipients.length === 0) {
        console.log("onNewMessage: No recipients to notify. Exiting.");
        return;
    }

    console.log(`onNewMessage: Found ${recipients.length} recipients to notify.`);

    const senderName = await getUserName(senderId);

    let title = senderName || 'New Message';
    let body = messageText.substring(0, 100);

    if (chatData.isGroup) {
        title = chatData.name || 'Group Chat';
        body = `${senderName || 'A user'}: ${body}`;
    }

    console.log(`onNewMessage: Notification details - Title: '${title}', Body: '${body}', EntityID: '${chatId}'`);

    const promises = recipients.map((recipientId: string) => {
        const notificationData = {
            userId: recipientId,
            title: title,
            message: body,
            ctaUrl: `/client/dashboard?notificationType=chat&entityId=${chatId}`,
            notificationType: 'chat',
            entityId: chatId, 
            sendTime: Timestamp.now(),
            processed: false,
        };
        console.log(`onNewMessage: Creating notification document for recipient: ${recipientId}`);
        return db.collection('notifications').add(notificationData);
    });

    await Promise.all(promises);
    console.log(`onNewMessage: Successfully created ${recipients.length} notification documents for chat ${chatId}.`);
});

// --- HYDRATION REMINDER ENGINE ---
export const hydrationReminderEngine = onSchedule('every 15 minutes', async (event) => {
    const now = Timestamp.now();
    
    const query = db.collection('hydration_reminders')
                    .where('status', '==', 'scheduled')
                    .where('scheduledAt', '<=', now);

    const snapshot = await query.get();

    if (snapshot.empty) {
        return;
    }

    console.log(`Found ${snapshot.docs.length} due hydration reminders.`);

    const promises = snapshot.docs.map(async (doc) => {
        const reminder = doc.data();
        const reminderId = doc.id;
        const userId = reminder.userId;

        try {
            const userRef = db.collection('clients').doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.log(`User ${userId} not found. Skipping reminder ${reminderId}.`);
                return;
            }

            const userData = userDoc.data();
            const userTier = userData?.tier;
            const ineligibleTiers = ['free', 'ad-free'];

            if (ineligibleTiers.includes(userTier)) {
                console.log(`User ${userId} is on tier '${userTier}' and not eligible for reminders. Skipping.`);
                return;
            }

            const notificationData = {
                userId: userId,
                title: '💧 Time to Hydrate!',
                message: 'Don\'t forget to log your water intake to stay on track with your goals.',
                ctaUrl: `/client/dashboard?notificationType=hydration`,
                notificationType: 'hydration',
                entityId: 'hydration', 
                sendTime: now,
                processed: false,
            };

            await db.collection('notifications').add(notificationData);
            console.log(`Created notification document for user ${userId} for reminder ${reminderId}.`);

            if (reminder.recurring) {
                const nextScheduledAt = new Timestamp(reminder.scheduledAt.seconds + (24 * 60 * 60), reminder.scheduledAt.nanoseconds);
                await doc.ref.update({ scheduledAt: nextScheduledAt });
                console.log(`Rescheduled recurring reminder ${reminderId} for user ${userId}.`);
            } else {
                await doc.ref.update({ status: 'completed' });
                console.log(`Marked one-time reminder ${reminderId} as completed for user ${userId}.`);
            }
        } catch (error) {
            console.error(`Error processing reminder ${reminderId} for user ${userId}:`, error);
        }
    });

    await Promise.all(promises);
});


// -----------------------------------------------------------------------------
// PART B: THE ENGINE (SENDS ALL PUSH NOTIFICATIONS)
// -----------------------------------------------------------------------------

async function sendPushNotification(userId: string, title: string, message: string, ctaUrl?: string, notificationType?: string, entityId?: string) {
  const userRef = db.collection('userProfiles').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
      console.log(`sendPushNotification: User profile ${userId} not found. Cannot send notification.`);
      return;
  }

  const userData = userDoc.data();
  if (!userData || !userData.fcmTokens || userData.fcmTokens.length === 0) {
      console.log(`sendPushNotification: User ${userId} has no FCM tokens. Cannot send notification.`);
      return;
  }

  const tokens = userData.fcmTokens.filter((t: string) => t);
  if (tokens.length === 0) {
      console.log(`sendPushNotification: No valid FCM tokens for user ${userId}.`);
      return;
  }

  const dataPayload = {
      title: title,
      body: message,
      ctaUrl: ctaUrl || '/',
      notificationType: notificationType || 'general',
      entityId: entityId || 'none',
  };

  const payload = {
    tokens: tokens,
    data: dataPayload,
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
            data: dataPayload 
        }
    },
    android: {
        priority: 'high' as const,
        notification: {
            title: title,
            body: message,
            channelId: 'default_notification_channel',
            icon: 'ic_notification',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK', 
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
                badge: 1, 
                category: 'HUNGREE_NOTIFICATION_ACTIONS'
            },
            ...dataPayload
        },
        headers: {
            'apns-push-type': 'alert', 
            'apns-priority': '10',
        },
    },
  };

  try {
    await messaging.sendEachForMulticast(payload as any);
    console.log(`sendPushNotification: Successfully sent notification to user ${userId} for type '${notificationType}'.`);
  } catch (error) {
    console.error(`sendPushNotification: Error sending push notification to user ${userId}:`, error);
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

  console.log(`unifiedNotificationEngine: Found ${snapshot.docs.length} notifications to process.`);

  const promises = snapshot.docs.map(async (doc) => {
    const notification = doc.data();
    
    await doc.ref.update({ processed: true });

    console.log(`unifiedNotificationEngine: Processing notification ${doc.id} for user ${notification.userId}`);
    
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
