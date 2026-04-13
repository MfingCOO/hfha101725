import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized with service account key');
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      admin.initializeApp(); // fallback
    }
  } else {
    admin.initializeApp();
    console.log('⚠️ Firebase Admin initialized with default credentials (no key found)');
  }
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };