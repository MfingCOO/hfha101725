import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized successfully with service account');
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      admin.initializeApp(); // fallback
    }
  } else {
    // Fallback for local development
    admin.initializeApp();
    console.log('⚠️ Firebase Admin initialized with default credentials (no service account key found)');
  }
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };