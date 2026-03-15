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
import { getMessaging, Messaging } from "firebase/messaging";
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

// 2. Initialize Firestore with MODERN Persistence
// This replaces the old enableIndexedDbPersistence call entirely.
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() // Allows multiple tabs to share the same cache!
  })
});

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
let messaging: Messaging | undefined;

// We initialize messaging safely for the web environment
if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.warn("Messaging not supported in this browser context", e);
  }
}

/**
 * Since persistence is now handled inside initializeFirestore, 
 * this function can be greatly simplified or just resolve immediately
 * to maintain compatibility with your existing root-providers.tsx.
 */
export const initializeFirebasePersistence = async () => {
  console.log("Firebase services and modern cache initialized.");
  return Promise.resolve();
};

export { app, auth, db, storage, messaging };