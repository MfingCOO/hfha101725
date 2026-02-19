
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';

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
        console.error('CRITICAL ERROR: Firebase Admin initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.', e);
        throw new Error("Firebase Admin SDK initialization failed.");
    }
  } else {
    app = getApps()[0];
  }
} else {
    throw new Error("CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app).bucket('hunger-free-and-happy-app.appspot.com');
const messaging = getMessaging(app);

export { db, auth, storage, app, messaging };
