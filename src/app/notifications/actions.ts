'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * A secure, server-side action to fetch all scheduled reminders for a specific user.
 * This function uses the Admin SDK, bypassing client-side security rules.
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

        // Convert the reminders to a client-safe format, serializing Timestamps to ISO strings.
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
