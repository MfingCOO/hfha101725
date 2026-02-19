
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';

let app;

// Use service account from environment variable
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  if (!getApps().length) {
    console.log('[Firebase Admin] Initializing with Service Account from environment variable...');
    try {
      const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const serviceAccount = JSON.parse(serviceAccountString);

      // THIS IS THE FIX: Correct the formatting of the private key
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: 'hunger-free-and-happy-app',
        databaseURL: 'https://hunger-free-and-happy-app.firebaseio.com'
      });
      console.log('[Firebase Admin] Initialization from environment variable successful.');
    } catch (e) {
        console.error('CRITICAL ERROR during Firebase Admin initialization:', e);
        // Fallback to default credentials if service account parsing fails
        app = initializeApp({ credential: applicationDefault(), projectId: 'hunger-free-and-happy-app' });
    }
  } else {
    app = getApps()[0];
  }
} else {
  // Fallback for environments where the key is not set
  if (!getApps().length) {
    console.log('[Firebase Admin] Initializing with default application credentials...');
    app = initializeApp({ credential: applicationDefault(), projectId: 'hunger-free-and-happy-app' });
  } else {
    app = getApps()[0];
  }
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app).bucket('hunger-free-and-happy-app.appspot.com');
const messaging = getMessaging(app);

export { db, auth, storage, app, messaging };
