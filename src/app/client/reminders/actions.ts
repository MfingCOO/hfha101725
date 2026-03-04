'use server';

import { db } from '@/lib/firebaseAdmin';
import { Reminder } from '@/services/reminders';

export async function getSmartReminderAction(userId: string) {
  try {
    if (!userId) return { success: false, error: 'User ID is required' };

    // Fetch the latest unseen notification for this user
    const snapshot = await db
      .collection(`clients/${userId}/notifications`)
      .where('seen', '==', false)
      .orderBy('deliverAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: true, data: null };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      success: true,
      data: {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string for the client
        deliverAt: data.deliverAt?.toDate().toISOString(),
      } as any
    };
  } catch (error: any) {
    console.error('Error in getSmartReminderAction:', error);
    return { success: false, error: error.message };
  }
}