// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { Capacitor } from '@capacitor/core'; // Import Capacitor

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
const functions = getFunctions(app); // Assuming default region

// Conditionally initialize Firebase Messaging for web only
let messaging = null;
if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  // Dynamically import getMessaging only on the client-side and if not a native platform
  import('firebase/messaging')
    .then(({ getMessaging }) => {
      messaging = getMessaging(app);
      // You might also want to add web-specific messaging listeners here
      // e.g., onMessage(messaging, (payload) => { ... });
    })
    .catch(error => {
      console.error("Error initializing Firebase Web Messaging:", error);
    });
}

export { app, db, auth, storage, functions, messaging }; // Export messaging as well