
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
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

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// db is now a 'let' and will be initialized asynchronously within initializeFirebasePersistence.
let db: Firestore;
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
      try {
        // MODERN API: Initialize Firestore with persistence enabled.
        // This call enables persistence for the current tab.
        db = initializeFirestore(app, {
          localCache: persistentLocalCache()
        });
        console.log("Offline persistence has been enabled.");
      } catch (err: any) {
        // This can happen if another tab has already initialized persistence.
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed: another tab may have it enabled.");
        } else if (err.code === 'unimplemented') {
          console.warn("Firestore persistence is not available in this browser.");
        } else {
            console.error("An error occurred while enabling Firestore persistence:", err);
        }
        // Fallback to regular initialization if persistence fails.
        db = getFirestore(app);
      } finally {
        // Initialize messaging after Firestore is set up.
        try {
          messaging = getMessaging(app);
        } catch (e) {
          console.error("Could not initialize messaging", e);
        }
        resolve();
      }
    } else {
      // For native or SSR, just initialize Firestore without persistence.
      db = getFirestore(app);
      resolve();
    }
  });

  return persistencePromise;
};

// Export the initialized services for the rest of the app to use.
// The 'db' export is a live binding that will be populated by initializeFirebasePersistence.
export { app, auth, db, storage, messaging };
