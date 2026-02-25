import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK only once.
try {
  initializeApp();
} catch (e) {
  console.log("Admin SDK already initialized.");
}

// Export the initialized services for use across all functions.
export const db = getFirestore();
export const messaging = getMessaging();
export const auth = getAuth();
