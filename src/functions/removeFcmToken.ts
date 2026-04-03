import * as functions from 'firebase-functions';
const cors = require('cors');
import { db, auth } from '@/lib/firebaseAdmin'; 
import * as admin from 'firebase-admin';

const corsHandler = cors({ origin: true });

export const removeFcmToken = functions.https.onRequest((request, response) => {
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

    if (!token) {
        response.status(400).send('Bad Request: Missing token.');
        return;
    }

    try {
        const collectionName = isCoach ? 'coaches' : 'clients';
        const docRef = db.collection(collectionName).doc(uid);

        const doc = await docRef.get();
        if (doc.exists) {
            await docRef.update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
            });
        }

        response.status(200).send({ success: true, message: 'FCM token removed successfully.' });

    } catch (error) {
        console.error('Error removing FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
