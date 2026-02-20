
import * as admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

let db: Firestore;
let auth: Auth;
let storage: ReturnType<ReturnType<typeof getStorage>["bucket"]>;
let messaging: Messaging;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountString) {
      throw new Error('The FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    }

    const serviceAccount = JSON.parse(serviceAccountString);

    // THIS IS THE ONLY FIX NEEDED: The private key in a JSON environment variable 
    // has its newlines escaped. This line replaces the escaped '\n' with actual newlines.
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'hunger-free-and-happy-app.appspot.com'
    });

  } catch (error: any) {
    console.error("CRITICAL: Firebase Admin initialization has failed.", error);
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

db = getFirestore();
auth = getAuth();
storage = getStorage().bucket();
messaging = getMessaging();

export { db, auth, storage, messaging, admin };
