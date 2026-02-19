
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import * as admin from 'firebase-admin';

let app;

if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  if (!getApps().length) {
    try {
      const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const serviceAccount = JSON.parse(serviceAccountString);

      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: 'hunger-free-and-happy-app',
        databaseURL: 'https://hunger-free-and-happy-app.firebaseio.com'
      });

    } catch (e) {
        console.error('CRITICAL ERROR: Firebase Admin initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY.', e);
        throw new Error("Firebase Admin SDK initialization failed.");
    }
  } else {
    app = getApps()[0];
  }
} else {
    // This block can be removed or adjusted if you have other ways of initializing in different environments.
    // For now, we'll keep it to avoid breaking potential existing logic.
    if (!getApps().length) {
      console.log('Initializing Firebase Admin with default credentials');
      initializeApp();
    }
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app).bucket('hunger-free-and-happy-app.appspot.com');
const messaging = getMessaging(app);

// The original admin namespace is not directly modified, but we use it
// to ensure compatibility with code expecting admin.firestore.FieldValue, etc.
// We are exporting our initialized services, plus the original admin namespace
// for any other utilities it might provide.
export { db, auth, storage, app, messaging, admin };
