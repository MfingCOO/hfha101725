import * as admin from 'firebase-admin';

// This is the standard, server-friendly way to initialize the Admin SDK.
// When deployed to a Google Cloud environment (like Cloud Functions), 
// it automatically finds the necessary credentials without any .env files.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
