// FILE: scripts/test-chat-action.js

// This script is a self-contained version of your postMessageAction
// to allow for safe, local testing without needing a full Next.js build environment.

// ---------------- SETUP ----------------
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  // **FIX: Explicitly specify the Project ID AND Database URL to force the correct connection.**
  admin.initializeApp({
    projectId: 'hunger-free-and-happy-app',
    databaseURL: 'https://hunger-free-and-happy-app.firebaseio.com'
  });
}

const adminDb = admin.firestore();
const { FieldValue } = require('firebase-admin/firestore');
const COACH_UIDS = ['yue7fVPBQZg45vmfXXUH5PdG7jE2']; // Alan Roberts UID is included

// ---------------- THE ACTION LOGIC (Copied and adapted for testing) ----------------

// This is the logic from your actions.ts file, adapted to run in a standalone Node.js script.
async function testPostMessageAction(input) {
  console.log('[ACTION_LOGIC] Function triggered with input:', input);

  const { chatId, text, userId, userName, fileUrl, fileName } = input;
  const chatDocRef = adminDb.collection('chats').doc(chatId);

  try {
    const chatSnapshot = await chatDocRef.get();
    if (!chatSnapshot.exists) throw new Error("Chat does not exist.");
    const chatData = chatSnapshot.data();
    console.log('[ACTION_LOGIC] Found chat:', chatData.name);

    const messageText = text || fileName || 'Attachment';

    await adminDb.runTransaction(async (transaction) => {
      console.log('[ACTION_LOGIC] Starting database transaction...');
      const messagesCollectionRef = chatDocRef.collection('messages');
      const messageData = {
        userId,
        userName,
        timestamp: FieldValue.serverTimestamp(),
        isSystemMessage: false,
      };
      if(text) messageData.text = text;
      if(fileUrl) messageData.fileUrl = fileUrl;
      if(fileName) messageData.fileName = fileName;
      transaction.set(messagesCollectionRef.doc(), messageData);
      console.log('[ACTION_LOGIC] Staged new message in transaction.');

      const updateData = {
        lastMessage: {
          text: messageText,
          timestamp: FieldValue.serverTimestamp(),
          senderId: userId,
        }
      };

      if (!COACH_UIDS.includes(userId)) {
        updateData.lastClientMessageTimestamp = FieldValue.serverTimestamp();
      }
      
      const senderMetadataRef = adminDb.collection('user_chat_metadata').doc(`${userId}_${chatId}`);
      transaction.set(senderMetadataRef, {
        userId: userId,
        chatId: chatId,
        lastReadTimestamp: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.update(chatDocRef, updateData);
      console.log('[ACTION_LOGIC] Staged chat metadata and last message updates.');
    });
    console.log('[ACTION_LOGIC] Transaction committed successfully.');

    const recipients = chatData.participants.filter(pId => pId !== userId);
    const mutedBy = chatData.mutedBy || [];
    console.log(`[ACTION_LOGIC] Found ${recipients.length} recipients.`);

    for (const recipientId of recipients) {
      console.log(`[ACTION_LOGIC] Processing recipient: ${recipientId}`);
      if (COACH_UIDS.includes(recipientId) && mutedBy.includes(recipientId)) {
        console.log(`[ACTION_LOGIC] SKIPPED: Chat is muted for coach ${recipientId}.`);
        continue;
      }

      const notificationPayload = {
        title: `New message in ${chatData.name || 'chat'}`,
        body: `${userName}: ${messageText}`.slice(0, 100),
      };

      const userRef = adminDb.collection("userProfiles").doc(recipientId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.log(`[ACTION_LOGIC] SKIPPED: Recipient user document not found for id: ${recipientId}`);
        continue;
      }
      
      const userData = userDoc.data();
      if (!userData || !userData.fcmTokens || userData.fcmTokens.length === 0) {
        console.log(`[ACTION_LOGIC] SKIPPED: Recipient ${recipientId} has no FCM tokens.`);
        continue;
      }
      
      const validTokens = userData.fcmTokens.filter(t => t);
      if (validTokens.length === 0) {
        console.log(`[ACTION_LOGIC] SKIPPED: Recipient ${recipientId} has no VALID FCM tokens.`);
        continue;
      }
      
      console.log(`[ACTION_LOGIC] Found ${validTokens.length} valid tokens for ${recipientId}.`);
      
      const message = {
        tokens: validTokens,
        notification: {
          title: notificationPayload.title,
          body: notificationPayload.body
        },
        data: {
          chatId: String(chatId)
        },
        android: {
          priority: "high"
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notificationPayload.title,
                body: notificationPayload.body
              },
              badge: 1,
              sound: "default"
            }
          }
        }
      };

      try {
        console.log('[ACTION_LOGIC] Attempting to send notification...');
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[ACTION_LOGIC] SUCCESS: Notification sent to ${recipientId}. Response:`, JSON.stringify(response));
      } catch (error) {
        console.error(`[ACTION_LOGIC] FAILURE: Error sending notification to ${recipientId}:`, error);
      }
    }
    
    return { success: true };

  } catch (error) {
    console.error(`[ACTION_LOGIC] Critical error for chat ${chatId}:`, error);
    return { success: false, error: { message: error.message || `An unknown admin error occurred.` } };
  }
}

// ---------------- TEST RUNNER ----------------
async function runChatTest() {
  console.log('[TEST_RUNNER] Starting local test...');

  // --- All test data is now configured --- 
  const testInput = {
    chatId: 'Yq61qJwt4GJ2HZk4QtYV',
    text: 'This is a test message from the local diagnostic script.',
    userId: 'NyluiXScIxP6boK4SNFkvzarwtg1', // The person sending the message
    userName: 'Diagnostic Script',
    // fileUrl and fileName are optional
  };
  // --- No more changes are needed --- 


  try {
    console.log('[TEST_RUNNER] Executing the action logic with the following data:');
    console.log(testInput);
    const result = await testPostMessageAction(testInput);
    console.log('[TEST_RUNNER] EXECUTION COMPLETED.');
    console.log('[TEST_RUNNER] Final Result:', result);
  } catch (error) {
    console.error('[TEST_RUNNER] A critical error occurred while running the test:', error);
  }
}

runChatTest();
