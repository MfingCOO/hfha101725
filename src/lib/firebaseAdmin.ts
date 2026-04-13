import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  // 1. Grab the single big string you already have in Vercel
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      // 2. Turn that string into a readable object
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      // 3. Fix the formatting of the private key specifically (the \n issue)
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      // 4. Start Firebase using that fixed object
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized successfully with Service Account Key');
    } catch (error) {
      // If the JSON is blurry or broken, this will tell you exactly why
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    }
  } else {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY is missing from environment variables');
  }
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };