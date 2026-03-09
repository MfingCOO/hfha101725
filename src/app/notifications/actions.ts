'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { auth as adminAuth } from 'firebase-admin';

/**
 * A secure, server-side action to save a user's FCM token.
 * This always saves the token to the 'clients' collection.
 */
export async function saveFcmToken(userId: string, token: string): Promise<{ success: boolean; error?: string; }> {
    if (!userId || !token) {
        console.error("saveFcmToken: Missing userId or token.");
        return { success: false, error: "User ID and token are required." };
    }

    try {
        const docRef = adminDb.collection('clients').doc(userId);
        await docRef.set({ fcmTokens: [token] }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error('Error saving FCM token:', error);
        return { success: false, error: error.message };
    }
}

/**
 * A secure, server-side action to remove a user's FCM token.
 * This always removes the token from the 'clients' collection.
 */
export async function removeFcmToken(userId: string, token: string): Promise<{ success: boolean; error?: string; }> {
    if (!userId || !token) {
        console.error("removeFcmToken: Missing userId or token.");
        return { success: false, error: "User ID and token are required." };
    }

    try {
        const docRef = adminDb.collection('clients').doc(userId);
        await docRef.update({ fcmTokens: FieldValue.arrayRemove(token) });
        return { success: true };
    } catch (error: any) {
        console.error('Error removing FCM token:', error);
        return { success: false, error: error.message };
    }
}

/**
 * A secure, server-side action to fetch all scheduled reminders for a specific user.
 */
export async function getScheduledRemindersAction(userId: string): Promise<{ success: boolean; data?: any[]; error?: string; }> {
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }
    
    try {
        const q = adminDb.collection('user_scheduled_reminders')
            .where('userId', '==', userId)
            .where('status', '==', 'scheduled');

        const snapshot = await q.get();

        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const reminders = snapshot.docs.map(doc => {
            const data = doc.data();
            const serializableData: { [key: string]: any } = { id: doc.id };
            for (const key in data) {
                if (data[key] instanceof Timestamp) {
                    serializableData[key] = data[key].toDate().toISOString();
                } else {
                    serializableData[key] = data[key];
                }
            }
            return serializableData;
        });

        return { success: true, data: reminders };
    } catch (error: any) {
        console.error("Error fetching scheduled reminders:", error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
