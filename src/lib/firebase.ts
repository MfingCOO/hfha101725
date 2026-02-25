
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, Firestore, initializeFirestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';

// Standard Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f",
};

// Initialize Firebase and export the services directly.
// This is safe because the app's root will wait for persistence to be enabled.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// To prevent Firestore from being used before persistence is enabled, we initialize it without settings first
// and will re-initialize it in the specific persistence function.
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
let messaging: Messaging | undefined;

// A single promise to ensure persistence is only enabled once.
let persistencePromise: Promise<void> | null = null;

/**
 * This is the single, simple function to call at the root of the application.
 * It handles the asynchronous setup of IndexedDB persistence for Firestore on the web.
 * Once this promise resolves, all other parts of the app can safely use the exported 'db' instance.
 */
export const initializeFirebasePersistence = () => {
  if (persistencePromise) {
    return persistencePromise;
  }

  persistencePromise = new Promise((resolve) => {
    // Only run this for web clients, not native or server-side.
    if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
      enableIndexedDbPersistence(db)
        .then(() => {
          console.log("Offline persistence has been enabled.");
        })
        .catch((err) => {
          console.warn("Error enabling offline persistence: ", err);
        })
        .finally(() => {
          // Initialize messaging here after persistence is attempted.
          try {
            messaging = getMessaging(app);
          } catch (e) {
            console.error("Could not initialize messaging", e)
          }
          resolve(); // Resolve the promise regardless of persistence success.
        });
    } else {
      // For native or SSR, resolve immediately.
      resolve();
    }
  });

  return persistencePromise;
};

// Export the initialized services for the rest of the app to use.
export { app, auth, db, storage, messaging };
