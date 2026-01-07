'use server';

import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
// SIMPLIFIED: Using only the functions that are confirmed to work.
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
  const now = new Date(); // Current time in UTC.

  // 1. Delete all existing, pending hydration reminders for this user.
  const remindersQuery = db.collection('userScheduledReminders').where('userId', '==', userId).where('type', '==', 'hydration');
  
  try {
    const snapshot = await remindersQuery.get();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 2. Create new reminders with a robust timezone conversion method.
    for (const time of times) {
      
      // A) Get today's date string (e.g., "2024-07-21") in the user's timezone.
      const todayInUserTz = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
      
      // B) Create a full date-time string (e.g., "2024-07-21T16:59:00") for the desired time.
      const dateTimeStringInUserTz = `${todayInUserTz}T${time}:00`;
      
      // C) Use `toZonedTime` to correctly parse that string into a Date object that represents
      //    the exact moment in the user's timezone.
      let reminderDate = toZonedTime(dateTimeStringInUserTz, timezone);
      
      // D) Get the current time in the user's timezone for comparison.
      const userTimeNow = toZonedTime(now, timezone);

      // E) If the reminder time has already passed today, schedule it for tomorrow.
      if (reminderDate < userTimeNow) {
        reminderDate.setDate(reminderDate.getDate() + 1);
      }
      
      // F) `reminderDate` is now the correct Date object. Firestore's `Timestamp.fromDate`
      //    will correctly convert this to a UTC timestamp for storage.
      const scheduledAtUtc = reminderDate;

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
