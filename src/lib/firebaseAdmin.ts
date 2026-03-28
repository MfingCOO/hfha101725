
import admin from 'firebase-admin';

// Use a global object (globalThis) to ensure the Firebase Admin SDK is initialized only once.
// In Next.js server environment, modules can be re-evaluated, but globalThis persists across these.
if (!globalThis.firebaseAdminApp) { // MODIFIED: Changed variable name to avoid potential conflicts
  console.log("No Firebase Admin app found in globalThis. Initializing new app.");
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

    console.log("Initializing Firebase Admin app with credentials...");
    globalThis.firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'hunger-free-and-happy-app.firebasestorage.app'
    });
    console.log("Firebase Admin app initialized successfully.");

  } catch (error) {
    console.error("CRITICAL: Failed to parse or initialize Firebase Admin SDK:", error);
    console.error("Raw FIREBASE_SERVICE_ACCOUNT_KEY (first 50 chars):", serviceAccountString.substring(0, 50));
    throw new Error("Could not initialize Firebase Admin SDK. The FIREBASE_SERVICE_ACCOUNT_KEY is likely malformed or missing.");
  }

} else {
  console.log("Firebase Admin app already initialized in globalThis. Reusing existing app.");
}

const app = globalThis.firebaseAdminApp; // Use the globally stored app instance
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();

console.log("Firebase Admin SDK modules exported.");

export { admin, db, auth, storage, app, messaging };
