'use server';

import { db } from '@/lib/firebaseAdmin';
import { UserProfile, UserTier, ClientProfile } from '@/types';
import { startOfDay, format, subDays, addDays, addHours, isAfter } from 'date-fns';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// FIX: Define a local Challenge interface to resolve the import error.
export interface Challenge {
    id: string;
    name: string;
    description: string;
    dates: {
        from: Timestamp;
        to: Timestamp;
    };
    scheduledHabits?: any[];
    progress?: {
        [userId: string]: {
            [date: string]: {
                [habitName: string]: boolean;
            }
        }
    };
}

export interface Reminder {
    id: string;
    type: 'log' | 'reflect' | 'upgrade' | 'streak-congrats' | 'indulgence-prep' | 'indulgence-enjoy' | 'indulgence-recover' | 'custom-popup';
    title: string;
    message: string;
    pillarId: string;
    requiredTier?: UserTier;
    data?: any;
    deliverAt: Timestamp; // All reminders will now have a delivery time
}

/**
 * Recursively converts Firestore Timestamps to ISO strings for client-side compatibility.
 */
function serializeTimestamps(obj: any): any {
    if (!obj) return obj;
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => serializeTimestamps(item));
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = serializeTimestamps(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}

// This function remains but now includes the deliverAt field.
async function createUserNotification(userId: string, reminder: Omit<Reminder, 'id'>) {
    if (!userId) return;
    const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
    await notificationRef.set({
        ...reminder,
        createdAt: FieldValue.serverTimestamp(),
        seen: false,
    });
    return { id: notificationRef.id, ...reminder };
}

export async function dismissReminderAction(userId: string, notificationId: string): Promise<{ success: boolean; error?: string; }> {
    try {
        if (!userId || !notificationId) {
            throw new Error("User ID and Notification ID are required.");
        }
        // Instead of deleting, we mark it as seen to prevent it from being shown again.
        await db.collection(`clients/${userId}/notifications`).doc(notificationId).update({ seen: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error dismissing reminder: ", error);
        return { success: false, error: error.message };
    }
}

// Modified to include a delivery time.
export async function sendScheduledPopupNotification(popupData: any) {
  try {
    const { targetType, targetValue, title, message, id, deliveryTime, ...restData } = popupData;
    let targetUserIds: string[] = [];
    const userProfilesRef = db.collection('userProfiles');

    if (targetType === 'all') {
      const snapshot = await userProfilesRef.get();
      snapshot.forEach(doc => targetUserIds.push(doc.id));
    } else if (targetType === 'tier' && targetValue) {
      const snapshot = await userProfilesRef.where('tier', '==', targetValue).get();
      snapshot.forEach(doc => targetUserIds.push(doc.id));
    } else if (targetType === 'user' && targetValue) {
      targetUserIds.push(targetValue);
    }
    
    targetUserIds = [...new Set(targetUserIds)];

    if (targetUserIds.length > 0) {
        const deliverAt = deliveryTime ? Timestamp.fromDate(new Date(deliveryTime)) : Timestamp.now();

        const reminderPayload: Omit<Reminder, 'id'> = {
            type: 'custom-popup',
            title: title,
            message: message,
            pillarId: 'megaphone',
            deliverAt: deliverAt,
            data: {
                id: id,
                imageUrl: restData.imageUrl || '',
                ctaText: restData.ctaText || '',
                ctaUrl: restData.ctaUrl || '',
            }
        };

        const promises = targetUserIds.map(uid => createUserNotification(uid, reminderPayload));
        await Promise.all(promises);
    }
    return { success: true };
  } catch (error: any) {
    console.error(`Error in sendScheduledPopupNotification for popup ${popupData.id}:`, error);
    return { success: false, error: error.message };
  }
}


// NEW, EFFICIENT ACTION: Gets the next notification that is due to be shown.
export async function getNextDueNotificationAction(userId: string): Promise<{ success: boolean; reminder?: Reminder | null; error?: string }> {
    try {
        const now = Timestamp.now();
        const notificationsRef = db.collection(`clients/${userId}/notifications`)
            .where('seen', '==', false)
            .where('deliverAt', '<=', now)
            .orderBy('deliverAt', 'asc')
            .limit(1);

        const snapshot = await notificationsRef.get();

        if (snapshot.empty) {
            return { success: true, reminder: null };
        }

        const notificationDoc = snapshot.docs[0];
        const reminder = { id: notificationDoc.id, ...notificationDoc.data() } as Reminder;
        
        return { success: true, reminder: serializeTimestamps(reminder) };

    } catch (error: any) {
        console.error("Error in getNextDueNotificationAction: ", error);
        return { success: false, error: error.message };
    }
}

// NEW, EFFICIENT ACTION: Gets the time of the soonest-scheduled future notification.
export async function getNextNotificationTimeAction(userId: string): Promise<{ success: boolean; nextNotificationTime?: string | null; error?: string }> {
    try {
        const now = Timestamp.now();
        const notificationsRef = db.collection(`clients/${userId}/notifications`)
            .where('seen', '==', false)
            .where('deliverAt', '>', now)
            .orderBy('deliverAt', 'asc')
            .limit(1);

        const snapshot = await notificationsRef.get();

        if (snapshot.empty) {
            return { success: true, nextNotificationTime: null };
        }

        const notificationDoc = snapshot.docs[0];
        const reminder = notificationDoc.data() as Reminder;

        return { success: true, nextNotificationTime: serializeTimestamps(reminder.deliverAt) };

    } catch (error: any) {
        console.error("Error in getNextNotificationTimeAction: ", error);
        return { success: false, error: error.message };
    }
}

// The old getReminderAction is now DELETED, as its logic is inefficient and has been replaced.
