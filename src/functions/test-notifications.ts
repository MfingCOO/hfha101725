
import * as functions from "firebase-functions";
import { getMessaging } from "firebase-admin/messaging";
import { initializeApp, getApps } from "firebase-admin/app";

// This check ensures that the app is initialized only once.
if (!process.env.FUNCTIONS_EMULATOR && !getApps().length) {
  initializeApp();
}

/**
 * A callable function to send a test push notification for debugging.
 * Expects an object with 'token' and 'payload' properties.
 */
export const sendTestNotification = functions.https.onCall(async (data, context) => {
  // Ensure the user is authenticated to use this development tool
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { token, payload } = data;

  // Validate the presence of essential data
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "token" argument.');
  }

  if (!payload || !payload.data || !payload.data.type) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "payload" argument containing at least a "data.type" field.');
  }

  // Construct the message for FCM
  const message = {
    token: token,
    data: payload.data,
    // Include notification block if it exists in the payload
    ...(payload.notification && { notification: payload.notification }),
    // Include Android-specific channel configuration
    ...(payload.android && { android: payload.android }),
  };

  try {
    const response = await getMessaging().send(message);
    console.log("Successfully sent test message:", response);
    return { success: true, response };
  } catch (error) {
    console.error("Error sending test message:", error);
    // Propagate a more informative error to the client
    throw new functions.https.HttpsError('internal', 'Error sending test message', error);
  }
});
