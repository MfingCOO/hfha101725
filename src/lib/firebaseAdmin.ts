
import admin from 'firebase-admin';

// Add detailed logging to track the initialization process
console.log("Initializing Firebase Admin SDK...");

// Check if the default app is already initialized
let app;

if (!admin.apps.length) {
  console.log("No Firebase app initialized yet. Starting new initialization.");
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountString) {
    console.error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  console.log(`Service account key length: ${serviceAccountString.length}`);

  try {
    console.log("Attempting to parse service account key...");
    const serviceAccount = JSON.parse(serviceAccountString);
    console.log("Service account key parsed successfully.");

    // Correctly format the private key
    if (serviceAccount.private_key) {
      console.log("Formatting private key...");
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      console.log("Private key formatted.");
    }

    console.log("Initializing Firebase app with credentials...");
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'hunger-free-and-happy-app.firebasestorage.app'
    });
    console.log("Firebase app initialized successfully.");

  } catch (error) {
    console.error("CRITICAL: Failed to parse or initialize Firebase Admin SDK:", error);
    // Log a snippet of the key for verification, but not the whole thing for security.
    console.error("Raw FIREBASE_SERVICE_ACCOUNT_KEY (first 50 chars):", serviceAccountString.substring(0, 50));
    throw new Error("Could not initialize Firebase Admin SDK. The FIREBASE_SERVICE_ACCOUNT_KEY is likely malformed.");
  }

} else {
  console.log("Firebase app already initialized. Getting existing app.");
  app = admin.app();
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

console.log("Firebase Admin SDK modules exported.");

export { admin, db, auth, storage, app, messaging };
