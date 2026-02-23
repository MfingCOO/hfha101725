
import { admin, db } from '@/lib/firebaseAdmin';
import { UserTier } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { MulticastMessage } from 'firebase-admin/messaging';

export interface Reminder {
    id: string;
    type: 'log' | 'reflect' | 'upgrade' | 'streak-congrats' | 'indulgence-prep' | 'indulgence-enjoy' | 'indulgence-recover' | 'custom-popup' | 'appointment_reminder' | 'mia_alert' | 'challenge_checkin' | 'appointment_booked';
    title: string;
    message: string;
    pillarId: string;
    entityId?: string;
    requiredTier?: UserTier;
    data?: any;
    deliverAt: Timestamp;
}

const IMMEDIATE_PUSH_TYPES: Reminder['type'][] = [
    'appointment_booked', 
    'mia_alert', 
    'challenge_checkin',
    'streak-congrats',
    'custom-popup'
];

export async function createUserNotification(userId: string, reminder: Omit<Reminder, 'id'>) {
    if (!userId) return;

    try {
        const notificationRef = db.collection(`clients/${userId}/notifications`).doc();
        await notificationRef.set({
            ...reminder,
            createdAt: FieldValue.serverTimestamp(),
            seen: false,
        });

        if (IMMEDIATE_PUSH_TYPES.includes(reminder.type)) {
            const clientRef = db.collection('clients').doc(userId);
            const clientDoc = await clientRef.get();

            if (clientDoc.exists) {
                const clientData = clientDoc.data();
                const tokens = clientData?.fcmTokens?.filter((t: string) => t) || [];

                if (tokens.length > 0) {
                    const dataPayload: { [key: string]: string } = {
                        title: reminder.title,
                        body: reminder.message,
                        notificationType: reminder.type,
                        pillarId: reminder.pillarId,
                        ...(reminder.entityId && { entityId: reminder.entityId }),
                        ...Object.fromEntries(Object.entries(reminder.data || {}).map(([key, value]) => [key, String(value)]))
                    };
                    
                    const payload: MulticastMessage = {
                        tokens: tokens,
                        data: dataPayload,
                        apns: {
                            headers: { 'apns-priority': '10' },
                            payload: {
                                aps: {
                                    sound: 'default'
                                }
                            }
                        },
                        android: {
                            priority: "high",
                            // BUG FIX: Added channelId for Android notifications
                            notification: {
                                channelId: "default",
                                sound: "default"
                            }
                        },
                    };

                    await admin.messaging().sendEachForMulticast(payload);
                    console.log(`IMMEDIATE push notification sent to user ${userId} for type ${reminder.type}`);
                }
            }
        } else {
            console.log(`Notification for user ${userId} (type: ${reminder.type}) is scheduled. Stored in DB, push will be sent later.`);
        }

        return { id: notificationRef.id, ...reminder };

    } catch (error) {
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

export async function sendScheduledPopupNotification(popupData: any) {
  try {
    const { targetType, targetValue, campaignName: title, message, campaignId: id, scheduledAt: deliveryTime, ...restData } = popupData;
    let targetUserIds: string[] = [];
    
    const clientsRef = db.collection('clients');

    if (targetType === 'all') {
      const snapshot = await clientsRef.get();
      snapshot.forEach(doc => targetUserIds.push(doc.id));
    } else if (targetType === 'tier' && targetValue) {
      const snapshot = await clientsRef.where('tier', '==', targetValue).get();
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
