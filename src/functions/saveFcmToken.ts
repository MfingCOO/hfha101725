
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
const cors = require('cors');
import { db, auth } from './firebase'; // Corrected: Import from the new firebase.ts file

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
    const { token, isCoach } = request.body.data;

    if (!token || isCoach === undefined) {
        response.status(400).send('Bad Request: Missing token or isCoach flag.');
        return;
    }

    try {
        const userDocRef = db.collection('users').doc(uid);
        await userDocRef.set({
            fcmTokens: FieldValue.arrayUnion(token),
            isCoach: isCoach
        }, { merge: true });

        response.status(200).send({ success: true, message: 'FCM token saved successfully.' });

    } catch (error) {
        console.error('Error saving FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
