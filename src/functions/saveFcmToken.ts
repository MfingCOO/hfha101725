import * as functions from 'firebase-functions';
import { db, auth } from '../lib/firebaseAdmin';
const cors = require('cors');

const corsHandler = cors({ origin: true });

export const saveFcmToken = functions.https.onRequest((request, response) => {
  corsHandler(request, response, async () => {

    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    const idToken = request.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        response.status(401).send('Unauthorized');
        return;
    }

    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
        console.error("Error verifying ID token:", error);
        response.status(403).send('Forbidden');
        return;
    }

    const uid = decodedToken.uid;
    const { token } = request.body.data; // Removed isCoach

    if (!token) {
        response.status(400).send('Bad Request: Missing token.');
        return;
    }

    try {
        // ALWAYS use the 'clients' collection as instructed
        const docRef = db.collection('clients').doc(uid);
        
        // Overwrite the tokens array with the new, fresh token.
        // This ensures only the most recent token is stored.
        await docRef.set({ fcmTokens: [token] }, { merge: true });

        response.status(200).send({ success: true, message: 'FCM token saved successfully.' });

    } catch (error) {
        console.error('Error saving FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
