import { initializeApp, getApps, App, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

let app: App;

// Use service account from environment variable for local development
if (process.env.NODE_ENV !== 'production' && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  if (!getApps().length) {
    console.log('[Firebase Admin] Initializing with Service Account from environment variable...');
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: 'hunger-free-and-happy-app',
        databaseURL: 'https://hunger-free-and-happy-app.firebaseio.com' // Explicitly set database URL
      });
      console.log('[Firebase Admin] Initialization from environment variable successful.');
    } catch (e) {
        console.error('CRITICAL ERROR during Firebase Admin initialization:', e);
        app = initializeApp({ credential: applicationDefault(), projectId: 'hunger-free-and-happy-app' });
    }
  } else {
    app = getApps()[0];
  }
} 
// Use Application Default Credentials for production or if local env var is not set
else {
  if (!getApps().length) {
    console.log('[Firebase Admin] Initializing with Application Default Credentials...');
    app = initializeApp({
      credential: applicationDefault(),
      projectId: 'hunger-free-and-happy-app',
    });
    console.log('[Firebase Admin] Initialization with Application Default Credentials successful.');
  } else {
    app = getApps()[0];
  }
}

const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const storage = getStorage(app);

const admin = {
  firestore: () => db,
  auth: () => auth,
  messaging: () => messaging,
  storage: () => storage,
};

export { db, auth, admin, messaging };
