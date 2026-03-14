
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// This is the correct way to initialize the Admin SDK in a server environment.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const uid = "h1pEG1aL7NODyUmtPerEVR4jzig1";
const newEmail = "swekluk@gmail.com";

async function changeUserEmail() {
  try {
    await getAuth().updateUser(uid, { email: newEmail });
    console.log(`SUCCESS: The email for user ${uid} has been definitively changed to ${newEmail} in Firebase Authentication.`);
  } catch (error: any) {
    console.error(`CRITICAL ERROR: Failed to update email for user ${uid}. Reason:`, error.message);
    if (error.code === 'auth/email-already-exists') {
        console.error("This email is already in use by another account.");
    } else if (error.code === 'auth/user-not-found') {
        console.error("The UID does not correspond to an existing user.");
    }
    process.exit(1); // Exit with a failure code
  }
}

changeUserEmail();
