
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
    const { token } = request.body.data;

    if (!token) {
        response.status(400).send('Bad Request: Missing token.');
        return;
    }

    try {
        const clientDocRef = db.collection('clients').doc(uid);

        // Use a transaction to make this operation atomic and robust.
        await db.runTransaction(async (transaction) => {
            const clientDoc = await transaction.get(clientDocRef);
            
            if (!clientDoc.exists) {
                // If the client document doesn't exist, create it with the new token.
                transaction.set(clientDocRef, { fcmTokens: [token] });
                return;
            }

            const data = clientDoc.data();
            const existingTokens = data?.fcmTokens || [];

            // Create a new array that doesn't contain the new token, then add it.
            // This effectively removes all previous instances and adds a single new one,
            // guaranteeing there are no duplicates.
            const filteredTokens = existingTokens.filter((t: string) => t !== token);
            filteredTokens.push(token);

            transaction.update(clientDocRef, { fcmTokens: filteredTokens });
        });

        response.status(200).send({ success: true, message: 'FCM token saved idempotently.' });

    } catch (error) {
        console.error('Error saving FCM token:', error);
        response.status(500).send('Internal Server Error');
    }
  });
});
