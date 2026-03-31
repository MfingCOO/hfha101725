'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { endOfDay } from 'date-fns';
import type { AvailabilitySettings, SiteSettings } from '@/types/index';

const eventSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required."),
    start: z.date(),
    end: z.date(),
    description: z.string().optional(),
    clientId: z.string().optional().nullable(),
    clientName: z.string().optional().nullable(),
    isPersonal: z.boolean().default(false),
    attachVideoLink: z.boolean().default(false),
    coachId: z.string().optional().nullable(),
    coachName: z.string().optional().nullable(),
    clientTimezone: z.string().optional(),
    isCoachBooking: z.boolean().optional().default(false),
});

type CalendarEventInput = z.infer<typeof eventSchema>;

function serializeTimestamps(docData: any): any {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
        if (newObject[key] instanceof Timestamp) {
            newObject[key] = newObject[key].toDate().toISOString();
        } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
            newObject[key] = serializeTimestamps(newObject[key]);
        }
    }
    return newObject;
}

export async function getCoachEvents(startDate: Date, endDate: Date) {
    try {
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endOfDay(endDate));

        const q = adminDb.collection('coachCalendar')
            .where('start', '>=', startTimestamp)
            .where('start', '<=', endTimestamp);
            
        const snapshot = await q.get();
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...serializeTimestamps(doc.data())
        }));

        return { success: true, data: events };
    } catch (error: any) {
        console.error("Error fetching coach events:", error);
        return { success: false, error: error.message };
    }
}

// ================================================
// FIXED saveCalendarEvent - this is the only change
// ================================================
export async function saveCalendarEvent(eventData: CalendarEventInput) {
    const validation = eventSchema.safeParse({
        ...eventData,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
    });

    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    const { id, isCoachBooking, ...dataToSave } = validation.data;
    const slotId = dataToSave.start.toISOString();

    let finalEventData: any = {
        ...dataToSave,
        start: Timestamp.fromDate(dataToSave.start),
        entryDate: Timestamp.fromDate(dataToSave.start),
        end: Timestamp.fromDate(dataToSave.end),
        videoCallLink: null,
    };

    if (dataToSave.attachVideoLink) {
        const settingsDocRef = adminDb.collection('siteSettings').doc('v1');
        const settingsSnap = await settingsDocRef.get();
        if (settingsSnap.exists) {
            const siteSettings = settingsSnap.data() as SiteSettings;
            if (siteSettings.videoCallLink) {
                finalEventData.videoCallLink = siteSettings.videoCallLink;
            }
        }
    }

    try {
        let eventId: string;

        if (isCoachBooking) {
            const eventRef = id 
                ? adminDb.collection('coachCalendar').doc(id) 
                : adminDb.collection('coachCalendar').doc();

            if (id) {
                await eventRef.set(finalEventData, { merge: true });
            } else {
                await eventRef.set(finalEventData);   // ← plain set for new documents
            }
            eventId = eventRef.id;

            const slotDocRef = adminDb.collection('bookedSlots').doc(slotId);
            await slotDocRef.set({ bookedAt: Timestamp.now(), coachId: dataToSave.coachId });

        } else {
            const createdEventId = await adminDb.runTransaction(async (transaction) => {
                const slotDocRef = adminDb.collection('bookedSlots').doc(slotId);
                const slotDoc = await transaction.get(slotDocRef);

                if (slotDoc.exists) {
                    throw new Error("This time slot is no longer available. Please select another time.");
                }

                transaction.set(slotDocRef, { bookedAt: Timestamp.now(), coachId: dataToSave.coachId, clientId: dataToSave.clientId });
                
                const eventRef = id 
                    ? adminDb.collection('coachCalendar').doc(id) 
                    : adminDb.collection('coachCalendar').doc();

                if (id) {
                    transaction.set(eventRef, finalEventData, { merge: true });
                } else {
                    transaction.set(eventRef, finalEventData);   // ← plain set for new documents
                }

                return eventRef.id;
            });
            eventId = createdEventId;
        }

        return { success: true, id: eventId };

    } catch (error: any) {
        console.error("Error saving calendar event:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteCalendarEvent(eventId: string, startTime: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!eventId) {
            throw new Error("Event ID is required for deletion.");
        }

        await adminDb.runTransaction(async (transaction) => {
            const eventRef = adminDb.collection('coachCalendar').doc(eventId);
            transaction.delete(eventRef);

            if (startTime) {
                const slotId = new Date(startTime).toISOString();
                const slotDocRef = adminDb.collection('bookedSlots').doc(slotId);
                transaction.delete(slotDocRef);
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting calendar event:", error);
        return { success: false, error: error.message };
    }
}

export async function saveCoachAvailability(settings: AvailabilitySettings): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = adminDb.collection('siteSettings').doc('v1');
        await docRef.set({ availability: settings }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving coach availability:", error);
        return { success: false, error: error.message };
    }
}

export async function getCoachAvailabilityAndEvents(startDate: Date, endDate: Date) {
    try {
        const settingsDocRef = adminDb.collection('siteSettings').doc('v1');
        const settingsSnap = await settingsDocRef.get();
        const siteSettings = settingsSnap.data() as SiteSettings | undefined;

        const availability = siteSettings?.availability || null;

        const eventsResult = await getCoachEvents(startDate, endDate);
        if (!eventsResult.success) {
            throw new Error(eventsResult.error || 'Failed to fetch existing events.');
        }

        return {
            success: true,
            data: {
                availability,
                events: eventsResult.data,
            }
        };

    } catch (error: any) {
        console.error("Error in getCoachAvailabilityAndEvents:", error);
        return { success: false, error: error.message };
    }
}