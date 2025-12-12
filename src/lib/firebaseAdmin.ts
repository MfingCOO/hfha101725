import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

// This is the new, correct way to initialize.
let app: App;
if (!getApps().length) {
  console.log('[Firebase Admin] Initializing with Application Default Credentials...');
  app = initializeApp({
    projectId: 'hunger-free-and-happy-app',
  });
  console.log('[Firebase Admin] Initialization successful.');
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