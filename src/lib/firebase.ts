// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f",
  vapidKey: "BGNeYzhRRkl_ou3bZbjkSKTJ3SkrmfuOyRWS2wrJl92Huaz7ODJZEpIDQ4rhVdWi73UxaREQCw7b7Jj_sWs7PUU"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}


const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let messaging: Messaging;

if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
  messaging = getMessaging(app);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registration successful with scope: ', registration.scope);
      }).catch((err) => {
        console.log('Service Worker registration failed: ', err);
      });
  }
}

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code == 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence.');
      }
    });
}


export { db, auth, storage, messaging, app };
