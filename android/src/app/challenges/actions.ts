
'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import type { Challenge } from '@/services/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

function serializeTimestamps(docData: any) {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
      if (newObject[key] && typeof newObject[key].toDate === 'function') {
        newObject[key] = newObject[key].toDate().toISOString();
      } else if (key === 'dates' && newObject.dates) {
            newObject.dates = {
                from: newObject.dates.from.toDate().toISOString(),
                to: newObject.dates.to.toDate().toISOString(),
            }
      } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
          newObject[key] = serializeTimestamps(newObject[key]);
      }
    }
    return newObject;
}

/**
 * Fetches all challenges for a client using the Admin SDK to bypass security rules.
 */
export async function getChallengesForClient(): Promise<{ success: boolean; data?: Challenge[]; error?: any; }> {
    try {
        const challengesQuery = adminDb.collection('challenges').orderBy("dates.from", "desc");
        const challengesSnapshot = await challengesQuery.get();
        
        const challenges = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Challenge);
        const serializableData = challenges.map(serializeTimestamps);

        return { success: true, data: serializableData as Challenge[] };

    } catch (error: any) {
        console.error("Error fetching challenges for client (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

/**
 * Fetches the latest active challenge, or the next upcoming challenge if none are active.
 */
export async function getLatestChallengeForClient(): Promise<{ success: boolean; data?: Challenge | null; error?: any; }> {
    try {
        const challengesQuery = adminDb.collection('challenges')
            .orderBy("dates.from", "desc")
            .limit(1);
            
        const snapshot = await challengesQuery.get();
        
        if (snapshot.empty) {
            return { success: true, data: null };
        }

        const challengeDoc = snapshot.docs[0];
        const challengeData = { id: challengeDoc.id, ...challengeDoc.data() };
        const serializableData = serializeTimestamps(challengeData);
        
        return { success: true, data: serializableData as Challenge };

    } catch (error: any) {
        console.error("Error fetching latest challenge for client (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

export async function joinChallengeAction(challengeId: string, userId: string): Promise<{ success: boolean, error?: string}> {
    if (!challengeId || !userId) {
        return { success: false, error: "Challenge ID and User ID are required." };
    }

    const challengeRef = adminDb.collection('challenges').doc(challengeId);
    const userRef = adminDb.collection('clients').doc(userId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const challengeDoc = await transaction.get(challengeRef);
            if (!challengeDoc.exists) {
                throw new Error("Challenge not found!");
            }

            const challengeData = challengeDoc.data() as Challenge;

            if (challengeData.participants.includes(userId)) {
                // User is already in the challenge, so no need to do anything.
                return;
            }
            
            if (challengeData.participantCount >= challengeData.maxParticipants) {
                throw new Error("This challenge is already full.");
            }

            // Atomically update both documents
            transaction.update(challengeRef, {
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1)
            });

            transaction.update(userRef, {
                challengeIds: FieldValue.arrayUnion(challengeId)
            });
        });

        return { success: true };

    } catch (error: any) {
        console.error('Error joining challenge:', error);
        return { success: false, error: error.message || "An unknown error occurred while trying to join the challenge." };
    }
}
