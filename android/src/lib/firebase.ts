
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "hunger-free-and-happy-app",
  "appId": "1:1002580546718:web:a8574bfc3732c7c137978f",
  "storageBucket": "hunger-free-and-happy-app.firebasestorage.app",
  "apiKey": "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  "authDomain": "hunger-free-and-happy-app.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1002580546718"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // This error occurs if multiple tabs are open, as persistence can only be
      // enabled in one tab at a time. This is a normal and expected scenario.
      console.warn("Firestore persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the features required for persistence.
      console.error("Firestore persistence is not supported in this browser.");
    }
  });

const auth = getAuth(app);
const storage = getStorage(app);

let messaging: Messaging | null = null;
// Conditionally initialize messaging only on the client side and handle unsupported environments.
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app);
    } catch (err) {
        console.error("Firebase Messaging is not supported in this browser or environment:", err);
        messaging = null;
    }
}

export { app, db, auth, storage, messaging };
