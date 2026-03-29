import { db } from '@/lib/firebaseAdmin';
import { UserTier } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// This interface is the single source of truth for notification structures.
export interface Reminder {
    id: string;
    type: 'log' | 'reflect' | 'upgrade' | 'streak-congrats' | 'indulgence-prep' | 'indulgence-enjoy' | 'indulgence-recover' | 'custom-popup' | 'appointment_reminder' | 'challenge_checkin' | 'appointment_booked' | 'indulgence_checkin' | 'workout_reminder' | 'hydration';
    title: string;
    message: string;
    pillarId: string;
    entityId?: string;
    requiredTier?: UserTier;
    data?: any;
    deliverAt: Timestamp;
    url?: string;
    isCoach?: string;
    appointmentStartTimeMillis?: number;
}

// This function is now a "Dumb Writer". It is safe to call from Next.js Server Actions.
// Its ONLY job is to write a notification document to Firestore.
// The actual sending is handled by a Cloud Function listener.
export async function createUserNotification(userId: string, reminder: Omit<Reminder, 'id'>) {
    if (!userId) return;

    try {
        const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
        await notificationRef.set({
            ...reminder,
            createdAt: FieldValue.serverTimestamp(),
            seen: false,
        });
        
        console.log(`Notification document created for user ${userId} of type ${reminder.type}`);
        return { id: notificationRef.id, ...reminder };
    } catch (error: any) {
        console.error(`Failed to create user notification document for user ${userId}:`, error);
        return null;
    }
}

export async function dismissReminderAction(userId: string, notificationId: string): Promise<{ success: boolean; error?: string; }> {
    try {
        if (!userId || !notificationId) {
            throw new Error("User ID and Notification ID are required.");
        }
        await db.collection(`clients/${userId}/notifications`).doc(notificationId).update({ seen: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error dismissing reminder: ", error);
        return { success: false, error: error.message };
    }
}
