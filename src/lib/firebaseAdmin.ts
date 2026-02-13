import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

let app: App;

// Check if the app is already initialized
if (!getApps().length) {
  console.log('[Firebase Admin] Initializing with Application Default Credentials...');
  
  // Correctly initialize with both credentials and project ID
  app = initializeApp({
    credential: applicationDefault(), // This is the critical fix
    projectId: 'hunger-free-and-happy-app',
  });

  console.log('[Firebase Admin] Initialization successful.');
} else {
  // If already initialized, get the existing app
  app = getApps()[0];
}

// Export the initialized services
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const storage = getStorage(app);

// Optional: maintain the 'admin' namespace for compatibility if needed
const admin = {
  firestore: () => db,
  auth: () => auth,
  messaging: () => messaging,
  storage: () => storage,
};

export { db, auth, admin };
