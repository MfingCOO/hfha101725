
'use server';
/**
 * @fileOverview A unified Genkit flow to manage the lifecycle of scheduled pop-up campaigns.
 * This flow is designed to be run by a recurring cron job.
 */


import { defineFlow } from '@genkit-ai/core';
import { z } from 'zod';
import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendScheduledPopupNotification } from '@/services/reminders';

// Defines the shape of a Popup document for TypeScript
interface Popup {
  id: string;
  name: string;
  [key: string]: any; // Allows for other properties we don't need to name explicitly
}
// This flow processes all scheduled pop-up events.
export const processScheduledEventsFlow = async (dryRun: boolean = false) => {

    console.log(`Running scheduled pop-up processing... ${dryRun ? '[DRY RUN]' : ''}`);
    const now = Timestamp.now();
    const twentyFourHoursAgo = Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    let activatedPopups = 0;
    let completedPopups = 0;
    

    const masterBatch = db.batch();
    
    // --- 2. Process Pop-up Campaigns ---
    const scheduledPopupsQuery = db.collection('popups')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now);
    
    const activePopupsQuery = db.collection('popups')
      .where('status', '==', 'active')
      .where('scheduledAt', '<=', twentyFourHoursAgo);

    const [scheduledPopupsSnapshot, activePopupsSnapshot] = await Promise.all([
        scheduledPopupsQuery.get(),
        activePopupsQuery.get(),
    ]);

    // Process and deliver scheduled pop-ups
    if (!scheduledPopupsSnapshot.empty) {
        const deliveryPromises = scheduledPopupsSnapshot.docs.map(async (doc) => {
          const popupData = { id: doc.id, ...doc.data() } as Popup;
            console.log(`Delivering scheduled pop-up: ${popupData.name} (ID: ${popupData.id})`);
            // This is the critical missing line that actually delivers the notification.
            await sendScheduledPopupNotification(popupData);
            masterBatch.update(doc.ref, { status: 'active' });
            activatedPopups++;
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
    
    const processedPopups = activatedPopups + completedPopups;
console.log(`Processed ${processedPopups} pop-ups.`);

    
    return {
      processedPopups,
      activatedPopups,
      completedPopups
    };    
  }
