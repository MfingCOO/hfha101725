
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

let app: App;

// Check if the service account key is available
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!getApps().length) {
  if (serviceAccountKey) {
    console.log('[Firebase Admin] Initializing with service account key...');
    try {
      // The service account key is a JSON string, so we need to parse it.
      const serviceAccount = JSON.parse(serviceAccountKey);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: 'hunger-free-and-happy-app',
      });
      console.log('[Firebase Admin] Initialization with service account successful.');
    } catch (error) {
      console.error('[Firebase Admin] Error parsing service account key or initializing app:', error);
      // Fallback or throw error
      throw new Error('Failed to initialize Firebase Admin with service account.');
    }
  } else {
    // This will be the fallback for local development or other environments
    // where Application Default Credentials are set up.
    console.log('[Firebase Admin] Initializing with Application Default Credentials...');
    app = initializeApp({
      projectId: 'hunger-free-and-happy-app',
    });
    console.log('[Firebase Admin] Initialization with ADC successful.');
  }
} else {
  app = getApps()[0];
}


// Export only the specific services you need.
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const storage = getStorage(app);

// For compatibility, we can re-export the modular services
// under the 'admin' namespace if other parts of your code expect it.
const admin = {
  firestore: () => db,
  auth: () => auth,
  messaging: () => messaging,
  storage: () => storage,
  // Add other admin services here if you use them
};

export { db, auth, admin };
