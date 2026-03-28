
import { db } from '../lib/firebaseAdmin'; // MODIFIED: Removed 'admin', changed path to relative
import { UserTier } from '../types'; // MODIFIED: Changed path to relative
import { Timestamp, FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore'; // MODIFIED: Added QueryDocumentSnapshot
// REMOVED: import { MulticastMessage } from 'firebase-admin/messaging';
import { sendPushNotification } from '../functions/index'; // MODIFIED: Changed path to relative

export interface Reminder {
    id: string;
    type: 'log' | 'reflect' | 'upgrade' | 'streak-congrats' | 'indulgence-prep' | 'indulgence-enjoy' | 'indulgence-recover' | 'custom-popup' | 'appointment_reminder' | 'challenge_checkin' | 'appointment_booked' | 'indulgence_checkin'; // MODIFIED: Added new types, removed 'mia_alert'
    title: string;
    message: string;
    pillarId: string;
    entityId?: string;
    requiredTier?: UserTier;
    data?: any;
    deliverAt: Timestamp;
    url?: string; // ADDED
    isCoach?: string; // ADDED
    appointmentStartTimeMillis?: number; // ADDED
}

const IMMEDIATE_PUSH_TYPES: Reminder['type'][] = [
    'appointment_booked',
    'challenge_checkin',
    'streak-congrats',
    'custom-popup'
]; // MODIFIED: Removed 'mia_alert', ensuring only truly immediate pushes are here

export async function createUserNotification(userId: string, reminder: Omit<Reminder, 'id'>) {
    if (!userId) return;

    try {
        const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
        await notificationRef.set({
            ...reminder,
            createdAt: FieldValue.serverTimestamp(),
            seen: false,
        });

        // MODIFIED: Delegate FCM sending to the centralized sendPushNotification
        if (IMMEDIATE_PUSH_TYPES.includes(reminder.type)) {
            // Extract necessary data, falling back to undefined or empty string as appropriate
            await sendPushNotification(
                userId,
                reminder.title,
                reminder.message,
                reminder.url || '', // Use url from reminder
                reminder.type,
                reminder.entityId || '',
                reminder.data?.imageUrl || undefined, // imageUrl might be in data for generic notifications
                reminder.data?.senderId || undefined, // senderId for specific types if passed in data
                reminder.data?.senderName || undefined, // senderName for specific types if passed in data
                reminder.data?.messageText || reminder.message || undefined, // messageText, fallback to reminder.message
                reminder.appointmentStartTimeMillis || undefined, // appointmentStartTimeMillis from reminder
                reminder.isCoach || undefined // isCoach from reminder
            );
            console.log(`IMMEDIATE push notification delegated to sendPushNotification for user ${userId} for type ${reminder.type}`);

        } else {
            console.log(`Notification for user ${userId} (type: ${reminder.type}) is scheduled. Stored in DB, push will be sent later (via Cloud Functions triggers).`);
        }

        return { id: notificationRef.id, ...reminder };

    } catch (error: any) {
        console.error(`Failed to create user notification for user ${userId}:`, error);
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

// MODIFIED: sendScheduledPopupNotification now directly calls sendPushNotification
export async function sendScheduledPopupNotification(popupData: any) {
  try {
    const { targetType, targetValue, campaignName: title, message, campaignId: id, scheduledAt: deliveryTime, ...restData } = popupData;
    let targetUserIds: string[] = [];
    
    const clientsRef = db.collection('clients');

    if (targetType === 'all') {
      const snapshot = await clientsRef.get();
      snapshot.forEach((doc: QueryDocumentSnapshot) => targetUserIds.push(doc.id)); // MODIFIED: Added type for doc
    } else if (targetType === 'tier' && targetValue) {
      const snapshot = await clientsRef.where('tier', '==', targetValue).get();
      snapshot.forEach((doc: QueryDocumentSnapshot) => targetUserIds.push(doc.id)); // MODIFIED: Added type for doc
    } else if (targetType === 'user' && targetValue) {
      targetUserIds.push(targetValue);
    }
    
    targetUserIds = [...new Set(targetUserIds)];

    if (targetUserIds.length > 0) {
        const deliverAt = deliveryTime ? Timestamp.fromDate(new Date(deliveryTime)) : Timestamp.now();

        // The original reminderPayload is now primarily for Firestore storage if needed
        const reminderPayloadForFirestore: Omit<Reminder, 'id'> = {
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
            },
            // Pass these for type consistency if createUserNotification were still sending FCM
            url: restData.ctaUrl || '', 
            isCoach: 'false', // Assuming popups are generally client-facing
            appointmentStartTimeMillis: undefined,
        };
        
        const promises = targetUserIds.map(async (uid) => {
            // First, store the notification in Firestore
            const notificationRef = db.collection(`clients/${uid}/notifications`).doc();
            await notificationRef.set({
                ...reminderPayloadForFirestore,
                createdAt: FieldValue.serverTimestamp(),
                seen: false,
            });

            // Then, send the push notification directly
            await sendPushNotification(
                uid,
                title,
                message,
                restData.ctaUrl || '', // ctaUrl from popupData
                'custom-popup', // Explicit type
                id || '', // campaignId as entityId
                restData.imageUrl || undefined, // imageUrl from popupData
                undefined, // senderId
                undefined, // senderName
                message, // messageText
                undefined, // appointmentStartTimeMillis
                'false' // isCoachParam, assuming client-facing
            );
            console.log(`SCHEDULED popup notification sent to user ${uid} for campaign ${id}`);
            return { id: notificationRef.id, ...reminderPayloadForFirestore };
        });

        await Promise.all(promises);
    }
    return { success: true };
  } catch (error: any) {
    console.error(`Error in sendScheduledPopupNotification for popup ${popupData.id}:`, error);
    return { success: false, error: error.message };
  }
}
