import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  Firestore, 
  getFirestore 
} from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f",
};

// 1. Initialize App
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Firestore with Modern Persistence (HEAD version logic)
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() 
  })
});

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
let messaging: Messaging | undefined;

// 3. Initialize messaging safely (GitHub version logic)
if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  isSupported().then((supported) => {
    if (supported) {
      try {
        messaging = getMessaging(app);
      } catch (e) {
        console.warn("Messaging initialization failed", e);
      }
    }
  });
}

/**
 * Compatibility function for root-providers.tsx
 */
export const initializeFirebasePersistence = async () => {
  console.log("Firebase services and multi-tab cache initialized.");
  return Promise.resolve();
};

export { app, auth, db, storage, messaging };