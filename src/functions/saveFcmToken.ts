
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
const cors = require('cors');
import { db, auth } from './firebase';

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
    const { token } = request.body.data;

    if (!token) {
        response.status(400).send('Bad Request: Missing token.');
        return;
    }

    try {
        // We now point to 'clients', which you have confirmed is the source of truth for active users.
        const clientDocRef = db.collection('clients').doc(uid);
        
        await clientDocRef.set({
            fcmTokens: FieldValue.arrayUnion(token)
        }, { merge: true });

        response.status(200).send({ success: true, message: 'FCM token saved successfully to the client record.' });

    } catch (error) {
        console.error('Error saving FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
