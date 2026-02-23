
'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { endOfDay, subMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { AvailabilitySettings, SiteSettings } from '@/types/index';
import { createUserNotification } from '@/services/reminders';

// ADDED clientTimezone to the schema
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
    clientTimezone: z.string().optional(), // IANA timezone string, e.g., 'America/New_York'
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

export async function saveCalendarEvent(eventData: CalendarEventInput) {
    const validation = eventSchema.safeParse({
        ...eventData,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
    });

    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    try {
        const { id, ...dataToSave } = validation.data;
        
        let finalEventData: any = {
            ...dataToSave,
            start: Timestamp.fromDate(dataToSave.start),
            entryDate: Timestamp.fromDate(dataToSave.start),
            end: Timestamp.fromDate(dataToSave.end),
            videoCallLink: null, 
        };
        // We don't want to save the timezone to the main event document
        delete finalEventData.clientTimezone;


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
        
        const eventRef = id ? adminDb.collection('coachCalendar').doc(id) : adminDb.collection('coachCalendar').doc();
        
        await eventRef.set(finalEventData, { merge: true });

        const isAppointment = dataToSave.coachId && dataToSave.clientId;

        if (isAppointment) {
            // TIMEZONE FIX: Determine the correct timezone for the notification.
            let notificationTimezone = dataToSave.clientTimezone; // 1. Prioritize timezone from the browser.

            // 2. As a fallback, check the coach's saved profile in the database.
            if (!notificationTimezone && dataToSave.coachId) {
                const coachProfileSnap = await adminDb.collection('clients').doc(dataToSave.coachId).get();
                const coachProfile = coachProfileSnap.data();
                if (coachProfile?.timezone) {
                    notificationTimezone = coachProfile.timezone;
                }
            }
            
            // 3. Last resort is UTC, which was causing the bug.
            const finalTimezone = notificationTimezone || 'UTC';

            const formattedStartTime = formatInTimeZone(dataToSave.start, finalTimezone, 'PPP p');

            if (dataToSave.clientName) {
                await createUserNotification(dataToSave.coachId!, {
                    type: 'appointment_booked',
                    title: 'New Appointment Booked',
                    message: `${dataToSave.clientName} has booked a call with you for ${formattedStartTime}`,
                    pillarId: 'calendar',
                    deliverAt: Timestamp.now(),
                    entityId: eventRef.id
                });
            }

            const reminderTime = subMinutes(dataToSave.start, 10);
            if (reminderTime > new Date()) {

                if (dataToSave.clientName) {
                    await createUserNotification(dataToSave.coachId!, {
                        type: 'appointment_reminder',
                        title: 'Upcoming Appointment',
                        message: `Your appointment with ${dataToSave.clientName} is in 10 minutes.`,
                        pillarId: 'calendar',
                        entityId: eventRef.id,
                        deliverAt: Timestamp.fromDate(reminderTime)
                    });
                }

                if (dataToSave.coachName) {
                     await createUserNotification(dataToSave.clientId!, {
                        type: 'appointment_reminder',
                        title: 'Upcoming Appointment',
                        message: `Your appointment with ${dataToSave.coachName} is in 10 minutes.`,
                        pillarId: 'calendar',
                        entityId: eventRef.id,
                        deliverAt: Timestamp.fromDate(reminderTime)
                    });
                }
            }
        }

        return { success: true, id: eventRef.id };
    } catch (error: any) {
        console.error("Error saving calendar event:", error);
        return { success: false, error: error.message };
    }
}


export async function deleteCalendarEvent(eventId: string) {
    try {
        if (!eventId) {
            throw new Error("Event ID is required for deletion.");
        }
        await adminDb.collection('coachCalendar').doc(eventId).delete();
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
