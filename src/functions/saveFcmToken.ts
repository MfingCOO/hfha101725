
import * as functions from 'firebase-functions';
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
    const { token, isCoach } = request.body.data;

    if (!token) {
        response.status(400).send('Bad Request: Missing token.');
        return;
    }

    try {
        const collectionName = isCoach ? 'coaches' : 'clients';
        const docRef = db.collection(collectionName).doc(uid);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (!doc.exists) {
                transaction.set(docRef, { fcmTokens: [token] });
                return;
            }

            const data = doc.data();
            const existingTokens = data?.fcmTokens || [];

            if (!existingTokens.includes(token)) {
                const updatedTokens = [...existingTokens, token];
                transaction.update(docRef, { fcmTokens: updatedTokens });
            }
        });

        response.status(200).send({ success: true, message: 'FCM token saved successfully.' });

    } catch (error) {
        console.error('Error saving FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
