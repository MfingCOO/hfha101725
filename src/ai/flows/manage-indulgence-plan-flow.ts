'use server';
/**
 * @fileOverview A unified Genkit flow to manage the lifecycle of scheduled pop-up campaigns and user reminders.
 * This flow is designed to be run by a recurring cron job.
 */

import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendScheduledPopupNotification } from '@/services/reminders';

// Defines the shape of a Popup document for TypeScript
interface Popup {
  id: string;
  name: string;
  scheduledAt: Timestamp;
  [key: string]: any; 
}

// This is the UNIFIED flow that processes all scheduled events.
export const processScheduledEventsFlow = async (dryRun: boolean = false) => {
    console.log(`Running scheduled event processing... ${dryRun ? '[DRY RUN]' : ''}`);
    const now = Timestamp.now();
    const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    
    let activatedPopups = 0;
    let completedPopups = 0;
    let processedUserReminders = 0; 

    const masterBatch = db.batch();

    // --- 1. Process User-Scheduled Reminders ---
    // FINAL ROBUSTNESS FIX: Fetch all pending reminders and check time in code, with added safety checks.
    const userRemindersQuery = db.collection('userScheduledReminders');
    const userRemindersSnapshot = await userRemindersQuery.get();

    if (!userRemindersSnapshot.empty) {
        userRemindersSnapshot.docs.forEach(doc => {
            const reminderData = doc.data();

            // SUPER-ROBUSTNESS FIX: Check for existence AND correct type of 'scheduledAt' before processing.
            if (reminderData.scheduledAt && reminderData.scheduledAt instanceof Timestamp && reminderData.scheduledAt.toMillis() <= now.toMillis()) {
                console.log(`Processing user reminder for user ${reminderData.userId}`);
                const stickyPopupRef = db.collection('stickyPopups').doc();
                masterBatch.set(stickyPopupRef, {
                    userId: reminderData.userId,
                    message: reminderData.message,
                    type: reminderData.type || 'info',
                    createdAt: Timestamp.now(),
                    seen: false,
                });
                masterBatch.delete(doc.ref);
                processedUserReminders++;
            }
        });
    }

    // --- 2. Process Coach-Sent Pop-up Campaigns ---
    // ROBUSTNESS FIX: Fetch all scheduled popups and check the time in the code to avoid timezone query bugs.
    const scheduledPopupsQuery = db.collection('popups').where('status', '==', 'scheduled');
    const activePopupsQuery = db.collection('popups').where('status', '==', 'active').where('scheduledAt', '<=', twentyFourHoursAgo);

    const [scheduledPopupsSnapshot, activePopupsSnapshot] = await Promise.all([
        scheduledPopupsQuery.get(),
        activePopupsQuery.get(),
    ]);

    // Process and deliver scheduled pop-ups
    if (!scheduledPopupsSnapshot.empty) {
        const deliveryPromises = scheduledPopupsSnapshot.docs.map(async (doc) => {
            const popupData = { id: doc.id, ...doc.data() } as Popup;

            // THE FINAL FIX: Apply the same super-robust check here to prevent crashes from bad coach-set popups.
            if (popupData.scheduledAt && popupData.scheduledAt instanceof Timestamp && popupData.scheduledAt.toMillis() <= now.toMillis()) {
                console.log(`Delivering scheduled pop-up: ${popupData.name} (ID: ${popupData.id})`);
                await sendScheduledPopupNotification(popupData);
                masterBatch.update(doc.ref, { status: 'active' });
                activatedPopups++;
            }
        });
        await Promise.all(deliveryPromises);
    }

    // Mark old active pop-ups as completed
    if (!activePopupsSnapshot.empty) {
        activePopupsSnapshot.forEach(doc => {
            console.log(`Ending active pop-up ${doc.id}`);
            masterBatch.update(doc.ref, { status: 'ended' });
            completedPopups++;
        });
    }

    // --- 3. Commit all changes ---
    if (!dryRun) {
        await masterBatch.commit();
    }
    
    const processedItems = activatedPopups + completedPopups + processedUserReminders;
    console.log(`Processed ${processedItems} total items.`);
    
    return {
      totalProcessed: processedItems,
      activatedCoachPopups: activatedPopups,
      completedCoachPopups: completedPopups,
      processedUserReminders: processedUserReminders,
    };    
}