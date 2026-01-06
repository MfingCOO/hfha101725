'use server';

import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Deletes all existing hydration reminders and schedules new ones based on user preferences.
 * This is now the unified, server-side way to manage hydration reminders, making them reliable.
 * 
 * @param userId - The ID of the user.
 * @param times - An array of time strings in 'HH:mm' format (e.g., ['09:00', '14:30']).
 * @param timezone - The user's IANA timezone name (e.g., 'America/New_York').
 */
export const scheduleHydrationRemindersAction = async (userId: string, times: string[], timezone: string) => {
  if (!userId || !timezone) {
    console.error('scheduleHydrationRemindersAction: Missing userId or timezone');
    return { success: false, error: 'User ID and timezone are required.' };
  }

  const batch = db.batch();
  const now = new Date();

  // 1. Delete all existing, pending hydration reminders for this user to prevent duplicates.
  const remindersQuery = db.collection('userScheduledReminders').where('userId', '==', userId).where('type', '==', 'hydration');
  
  try {
    const snapshot = await remindersQuery.get();
    snapshot.docs.forEach(doc => {
      console.log(`Deleting old hydration reminder: ${doc.id}`);
      batch.delete(doc.ref);
    });

    // 2. Create new reminders based on the provided times.
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      
      const userTimeNow = toZonedTime(now, timezone);
      
      let reminderTimeInUserTz = new Date(userTimeNow.getFullYear(), userTimeNow.getMonth(), userTimeNow.getDate(), hour, minute);

      if (reminderTimeInUserTz < userTimeNow) {
        reminderTimeInUserTz.setDate(reminderTimeInUserTz.getDate() + 1);
      }
      
      // THIS IS THE CORRECTED LINE - No longer using the non-existent function.
      // We create a valid UTC date object directly.
      const scheduledAtUtc = new Date(reminderTimeInUserTz);

      const reminderRef = db.collection('userScheduledReminders').doc();
      batch.set(reminderRef, {
        userId,
        scheduledAt: Timestamp.fromDate(scheduledAtUtc),
        message: 'Time to hydrate! Don\'t forget to log your water intake.',
        type: 'hydration',
        createdAt: Timestamp.now(),
      });
      console.log(`Scheduling new hydration reminder for ${time} user time (${scheduledAtUtc.toISOString()} UTC)`);
    }

    // 3. Commit all the changes atomically.
    await batch.commit();
    console.log(`Successfully processed ${times.length} hydration reminders for user ${userId}.`);
    return { success: true };

  } catch (error: any) {
    console.error(`Failed to schedule hydration reminders for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
};
