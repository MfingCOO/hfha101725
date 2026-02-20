
import admin from 'firebase-admin';

// Check if the default app is already initialized
let app;

if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountString) {
    throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);

    // Correctly format the private key
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'hunger-free-and-happy-app.firebasestorage.app'
    });
  } catch (error) {
    console.error("Failed to parse or initialize Firebase Admin SDK:", error);
    console.error("Raw FIREBASE_SERVICE_ACCOUNT_KEY length:", serviceAccountString.length);
    throw new Error("Could not initialize Firebase Admin SDK. The FIREBASE_SERVICE_ACCOUNT_KEY is likely malformed.");
  }

} else {
  app = admin.app();
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

export { admin, db, auth, storage, app, messaging };
