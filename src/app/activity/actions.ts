'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { revalidatePath } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import { ActionResponse } from '@/types/action-response';

interface LogActivityPayload {
    userId: string;
    durationInMinutes: number;
    startTime: Date;
    notes?: string;
}

// This action is now architecturally correct.
// It creates a new document in the 'activity' collection,
// which the summary calculator is designed to read.
export async function logActivityAction(payload: LogActivityPayload): Promise<ActionResponse<{}>> {
    const { userId, durationInMinutes, startTime, notes } = payload;

    if (!userId || !durationInMinutes || !startTime) {
        return { success: false, error: "User ID, duration, and start time are required to log activity." };
    }

    try {
        const activityRef = adminDb.collection('clients').doc(userId).collection('activity').doc();
        
        // The data object MUST match what summary-calculator expects.
        const activityData = {
            id: activityRef.id,
            entryDate: Timestamp.fromDate(startTime),
            pillar: 'activity',
            duration: durationInMinutes, // The key field for the summary calculator.
            notes: notes || ''
        };

        await activityRef.set(activityData);

        // Revalidate paths to trigger data refetching on the client.
        revalidatePath('/client/dashboard');
        revalidatePath('/calendar');

        return { success: true, data: {} };

    } catch (error: any) {
        console.error("Error logging activity:", error);
        return { success: false, error: "Failed to log workout activity." };
    }
}
