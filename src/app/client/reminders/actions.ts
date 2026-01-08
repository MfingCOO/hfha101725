'use server';

import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, addDays } from 'date-fns';

// The unified message format for the front-end.
export type InAppMessage = {
    id: string;
    userId: string;
    type: string; // Now a generic string
    title: string;
    message: string;
    scheduledAt: string; 
    createdAt: string;   
    isRecurring: boolean;
    ctaUrl?: string;
    ctaText?: string;      
    imageUrl?: string;     
};

// ----- POP-UP REGISTRY ----- //
// This is the new, scalable architecture. To add more pop-up types in the future, 
// you will only need to add a new entry to this registry.

const POPUP_CONFIG = {
    hydration_reminder: {
        collection: (userId: string) => db.collection('user_scheduled_reminders').doc(userId).collection('user_scheduled_reminders'),
        query: (collection: FirebaseFirestore.CollectionReference) => 
            collection.where('status', '==', 'scheduled').where('type', '==', 'hydration_reminder'),
        mapper: (doc: FirebaseFirestore.QueryDocumentSnapshot): InAppMessage => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId,
                type: 'hydration_reminder',
                title: data.title,
                message: data.message,
                isRecurring: data.isRecurring,
                ctaUrl: '/log', // DEFINITIVE FIX: Hardcoded to the correct URL.
                ctaText: data.ctaText,
                imageUrl: 'https://i.imgur.com/hE24b3O.png', // DEFINITIVE FIX: Using the correct, working image URL.
                scheduledAt: (data.scheduledAt as Timestamp).toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            };
        },
        dismiss: async (userId: string, messageId: string) => {
            const messageRef = POPUP_CONFIG.hydration_reminder.collection(userId).doc(messageId);
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(messageRef);
                if (!doc.exists) return;
                const data = doc.data()!;
                if (data.isRecurring) {
                    const nextDate = new Date(data.scheduledAt.toMillis() + 24 * 60 * 60 * 1000);
                    transaction.update(messageRef, { scheduledAt: Timestamp.fromDate(nextDate) });
                } else {
                    transaction.update(messageRef, { status: 'dismissed' });
                }
            });
        },
    },
    coach_popup: {
        collection: (userId: string) => db.collection('clients').doc(userId).collection('notifications'),
        query: (collection: FirebaseFirestore.CollectionReference) => 
            collection.where('seen', '==', false).where('type', '==', 'custom-popup'),
        mapper: (doc: FirebaseFirestore.QueryDocumentSnapshot): InAppMessage => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: doc.ref.parent.parent!.id,
                type: 'coach_popup',
                title: data.title,
                message: data.message,
                isRecurring: false,
                ctaUrl: data.data?.ctaUrl, // Correctly sourcing the URL
                ctaText: data.data?.ctaText,
                imageUrl: data.data?.imageUrl,
                scheduledAt: (data.deliverAt as Timestamp).toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            };
        },
        dismiss: async (userId: string, messageId: string) => {
            const messageRef = POPUP_CONFIG.coach_popup.collection(userId).doc(messageId);
            await messageRef.update({ seen: true });
        },
    }
};

// ----- CORE ACTIONS (REBUILT) ----- //

export const getDueMessagesAction = async (userId: string): Promise<{ success: boolean; messages?: InAppMessage[]; error?: string; }> => {
    if (!userId) return { success: false, error: 'User not authenticated.' };

    try {
        const now = Timestamp.now();
        let allMessages: InAppMessage[] = [];

        // Iterate over the registry, fetching and mapping messages for each type
        for (const type in POPUP_CONFIG) {
            const config = POPUP_CONFIG[type as keyof typeof POPUP_CONFIG];
            const collectionRef = config.collection(userId);
            // Correctly handle different timestamp fields
            const timestampField = type === 'coach_popup' ? 'deliverAt' : 'scheduledAt';
            const query = config.query(collectionRef).where(timestampField, '<=', now);
            const snapshot = await query.get();
            const messages = snapshot.docs.map(config.mapper);
            allMessages.push(...messages);
        }

        // Sort all gathered messages by time
        allMessages.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

        return { success: true, messages: allMessages };

    } catch (error: any) {
        console.error(`Error fetching due messages for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
};

export const dismissMessageAction = async (userId: string, messageId: string, type: string): Promise<{ success: boolean; error?: string; }> => {
    if (!userId || !messageId || !type) return { success: false, error: 'User, Message ID, and Type are required.' };
    
    try {
        const config = POPUP_CONFIG[type as keyof typeof POPUP_CONFIG];
        if (!config) throw new Error(`Invalid pop-up type: ${type}`);
        
        await config.dismiss(userId, messageId);
        return { success: true };

    } catch (error: any) {
        console.error(`Error dismissing message ${messageId}:`, error);
        return { success: false, error: error.message };
    }
};

// ----- SCHEDULING (UNCHANGED BUT INCLUDED FOR COMPLETENESS) ----- //

export const scheduleHydrationRemindersAction = async (userId: string, times: string[], timezone: string) => {
  if (!userId || !timezone) return { success: false, error: 'User ID and timezone are required.' };
  const batch = db.batch();
  const remindersCollection = POPUP_CONFIG.hydration_reminder.collection(userId);

  try {
    const existingRemindersQuery = remindersCollection.where('type', '==', 'hydration_reminder');
    const snapshot = await existingRemindersQuery.get();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));

    for (const time of times) {
      const firstOccurrence = calculateFirstOccurrence(time, timezone);
      const reminderRef = remindersCollection.doc();
      batch.set(reminderRef, {
        userId,
        type: 'hydration_reminder',
        title: 'Time to Hydrate!',
        message: "Don't forget to log your water intake to stay on track with your goals.",
        ctaUrl: '/log', // Correct URL
        ctaText: 'Log Water',
        imageUrl: 'https://i.imgur.com/hE24b3O.png', // Correct Image
        scheduledAt: firstOccurrence, 
        status: 'scheduled',
        isRecurring: true,
        createdAt: Timestamp.now(),
      });
    }
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

function calculateFirstOccurrence(time: string, timezone:string): Timestamp {
    const nowInUserTz = toZonedTime(new Date(), timezone);
    const todayDateString = format(nowInUserTz, 'yyyy-MM-dd');
    const reminderDateTimeStringToday = `${todayDateString} ${time}:00`;
    let reminderUtc = fromZonedTime(reminderDateTimeStringToday, timezone);
    if (reminderUtc < new Date()) {
        const tomorrowInUserTz = addDays(nowInUserTz, 1);
        const tomorrowDateString = format(tomorrowInUserTz, 'yyyy-MM-dd');
        const reminderDateTimeStringTomorrow = `${tomorrowDateString} ${time}:00`;
        reminderUtc = fromZonedTime(reminderDateTimeStringTomorrow, timezone);
    }
    return Timestamp.fromDate(reminderUtc);
}