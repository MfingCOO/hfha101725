'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import type { Challenge } from '@/types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * Recursively traverses an object or array and converts all Firestore Timestamp
 * objects to ISO 8601 date strings. This is a safe and robust way to serialize
 * data for sending from Server Actions to Client Components.
 */
function serializeTimestamps(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle Firestore Timestamps
    if (obj.toDate && typeof obj.toDate === 'function') {
        return obj.toDate().toISOString();
    }

    // Handle arrays by recursively serializing each item
    if (Array.isArray(obj)) {
        return obj.map(serializeTimestamps);
    }

    // Handle objects by recursively serializing each value
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = serializeTimestamps(obj[key]);
        }
    }
    return newObj;
}


/**
 * Fetches all challenges for a client using the Admin SDK to bypass security rules.
 */
export async function getAllChallengesForClient(): Promise<{ success: boolean; data?: Challenge[]; error?: any; }> {
    try {
        const challengesQuery = adminDb.collection('challenges').orderBy("dates.from", "desc");
        const challengesSnapshot = await challengesQuery.get();
        
        const challenges = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Challenge);
        const serializableData = challenges.map(serializeTimestamps);

        return { success: true, data: serializableData as Challenge[] };

    } catch (error: any) {
        console.error("Error fetching challenges for client (admin): ", error);
        // Return a serializable error object
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
        // Return a serializable error object
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
            
            const currentCount = challengeData.participantCount || 0;
            const maxParticipants = (challengeData as any).maxParticipants || 999;

            if (currentCount >= maxParticipants) {
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
