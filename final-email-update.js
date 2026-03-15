
// This script uses CommonJS syntax for maximum compatibility with a standard Node.js environment.
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// 1. Check for the environment variable.
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error("CRITICAL ERROR: The FIREBASE_SERVICE_ACCOUNT_KEY secret is not available in the environment.");
  process.exit(1);
}

// 2. Parse the service account key.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// 3. Initialize the Firebase Admin SDK.
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const uid = "h1pEG1aL7NODyUmtPerEVR4jzig1";
const newEmail = "swekluk@gmail.com";

// 4. Perform the update.
async function changeUserEmail() {
  try {
    await getAuth().updateUser(uid, { email: newEmail });
    console.log(`SUCCESS: The email for user ${uid} has been definitively changed to ${newEmail} in Firebase Authentication.`);
  } catch (error) {
    console.error(`CRITICAL ERROR: Failed to update email for user ${uid}. Reason:`, error.message);
    process.exit(1); // Exit with a failure code.
  }
}

changeUserEmail();
