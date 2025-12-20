'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, DocumentSnapshot } from 'firebase-admin/firestore';
import { subDays, addDays, isWithinInterval } from 'date-fns';
import { calculateDailySummaryForUser } from '@/services/summary-calculator'; 
import { revalidatePath } from 'next/cache';

const ALL_DATA_COLLECTIONS = ['nutrition', 'hydration', 'activity', 'sleep', 'stress', 'measurements', 'protocol', 'planner', 'cravings'];

export async function triggerSummaryRecalculation(userId: string, date: string, userTimezone: string, timezoneOffset: number) {
    if (!userId || !date) {
        console.error("[Action] Missing userId or date for summary recalculation");
        return { success: false, error: "User ID and date are required." };
    }
    try {
        return await calculateDailySummaryForUser(userId, date, userTimezone, timezoneOffset);
    } catch (error: any) {
        console.error(`[Action] CRITICAL ERROR in triggerSummaryRecalculation for user ${userId} on date ${date}:`, error);
        return { success: false, error: error.message };
    }
}

function serializeTimestamps(data: any): any {
    if (!data) return data;
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeTimestamps);
    }
    if (typeof data === 'object' && Object.prototype.toString.call(data) === '[object Object]') {
        const newObject: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObject[key] = serializeTimestamps(data[key]);
            }
        }
        return newObject;
    }
    return data;
}

function unnestLogData(doc: DocumentSnapshot) {
    const data = doc.data();
    if (!data) return null;

    const baseData = { id: doc.id, ...data };
    if (data.log) {
        return { ...baseData, ...data.log };
    }
    return baseData;
}

export async function getCalendarDataForDay(userId: string, date: string, userTimezone: string, timezoneOffset: number): Promise<{ success: boolean; data?: any[]; summary?: any; error?: string }> {
    if (!userId) {
        console.error("No user ID provided to getCalendarDataForDay");
        return { success: false, error: "User ID is required." };
    }
     if (userTimezone === undefined || timezoneOffset === undefined) {
        console.error("Missing timezone information in getCalendarDataForDay");
        return { success: false, error: "Timezone information is required." };
    }

    const dateAtUtcMidnight = new Date(`${date}T00:00:00.000Z`);
    const offsetInMilliseconds = timezoneOffset * 60 * 1000;
    
    const filterRangeStartUTC = new Date(dateAtUtcMidnight.getTime() + offsetInMilliseconds);
    const filterRangeEndUTC = new Date(filterRangeStartUTC.getTime() + (24 * 60 * 60 * 1000) - 1);

    const firestoreQueryStartUTC = subDays(filterRangeStartUTC, 1);
    const firestoreQueryEndUTC = addDays(filterRangeEndUTC, 1);

    try {
        const summaryRef = adminDb.collection(`clients/${userId}/dailySummaries`).doc(date);
        const summaryPromise = summaryRef.get();

        const personalLogPromises = ALL_DATA_COLLECTIONS.map(async (collectionName) => {
            try {
                const collectionPath = `clients/${userId}/${collectionName}`;
                
                const dateField = collectionName === 'planner' ? 'indulgenceDate' : 'entryDate';
                const nestedDateField = collectionName === 'planner' ? 'log.indulgenceDate' : 'log.entryDate';

                const flatQuery = adminDb.collection(collectionPath).where(dateField, '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where(dateField, '<=', Timestamp.fromDate(firestoreQueryEndUTC));
                const nestedQuery = adminDb.collection(collectionPath).where(nestedDateField, '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where(nestedDateField, '<=', Timestamp.fromDate(firestoreQueryEndUTC))

                const [flatSnapshot, nestedSnapshot] = await Promise.all([
                    flatQuery.get(),
                    collectionName === 'planner' ? Promise.resolve({ docs: [] }) : nestedQuery.get()
                ]);

                const docs = new Map<string, DocumentSnapshot>();
                flatSnapshot.docs.forEach(doc => docs.set(doc.id, doc));
                nestedSnapshot.docs.forEach(doc => docs.set(doc.id, doc));

                return Array.from(docs.values()).map(doc => ({ ...unnestLogData(doc), pillar: collectionName }));
            } catch (error) {
                console.error(`Failed to fetch data for collection ${collectionName}:`, error);
                return [];
            }
        });

        const coachAppointmentsPromise = adminDb.collection('coachCalendar')
            .where('clientId', '==', userId)
            .where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC))
            .where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC))
            .get().then(snapshot =>
                snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { ...data, id: doc.id, pillar: 'appointment', entryDate: data.start };
                })
            ).catch(err => {
                console.error(`Failed to fetch coach appointments:`, err);
                return [];
            });

        const clientCalendarEventsPromise = adminDb.collection('clientCalendar')
            .where('userId', '==', userId)
            .where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC))
            .where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC))
            .get().then(snapshot =>
                snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { ...data, id: doc.id, pillar: data.type || 'live-event', entryDate: data.start };
                })
            ).catch(err => {
                console.error(`Failed to fetch client calendar events:`, err);
                return [];
            });

        const [summarySnap, personalLogsNested, coachAppointments, clientCalendarEvents] = await Promise.all([
            summaryPromise,
            Promise.all(personalLogPromises),
            coachAppointmentsPromise,
            clientCalendarEventsPromise
        ]);

        const allEntriesRaw = (personalLogsNested as any).flat().concat(coachAppointments as any).concat(clientCalendarEvents as any).filter(Boolean);

        const finalEntries = allEntriesRaw.filter(entry => {
            const getJSDate = (d: any) => {
                if (!d) return null;
                if (d.seconds) return new Date(d.seconds * 1000); 
                if (typeof d === 'string') return new Date(d);
                return null;
            }

            if (entry.pillar === 'sleep') {
                const wakeUpDay = getJSDate(entry.wakeUpDay);
                if (wakeUpDay && wakeUpDay.getTime() >= filterRangeStartUTC.getTime() && wakeUpDay.getTime() <= filterRangeEndUTC.getTime()) {
                    return true;
                }
                const entryDate = getJSDate(entry.entryDate);
                if (entry.isNap && entryDate && isWithinInterval(entryDate, { start: filterRangeStartUTC, end: filterRangeEndUTC })) {
                    return true;
                }
                return false;
            }
            if (entry.pillar === 'planner') {
                const indulgenceDate = getJSDate(entry.indulgenceDate);
                return indulgenceDate && isWithinInterval(indulgenceDate, { start: filterRangeStartUTC, end: filterRangeEndUTC });
            }
            const entryDate = getJSDate(entry.entryDate || entry.start);
            return entryDate && isWithinInterval(entryDate, { start: filterRangeStartUTC, end: filterRangeEndUTC });
        });

        finalEntries.sort((a: any, b: any) => {
            const getJSDate = (d: any) => d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
            const dateA = getJSDate(a.indulgenceDate || a.entryDate || a.wakeUpDay || a.start);
            const dateB = getJSDate(b.indulgenceDate || b.entryDate || b.wakeUpDay || b.start);
            return dateA.getTime() - dateB.getTime();
        });

        const serializableData = finalEntries.map(serializeTimestamps);
        const summaryData = summarySnap.exists ? serializeTimestamps(summarySnap.data()) : { calories: 0, hydration: 0, sleep: 0, activity: 0, upf: 0, allNutrients: {} };

        return { success: true, data: serializableData, summary: summaryData };

    } catch (e: any) {
        console.error("CRITICAL ERROR in getCalendarDataForDay: ", e);
        return { success: false, data: [], summary: {}, error: e.message || "An unknown server error occurred." };
    }
}

export async function getTodaysContextualData(userId: string) {
    if (!userId) return null;

    const startOfToday = new Date();
    const startTimestamp = Timestamp.fromDate(startOfToday);

    try {
        const sleepPath = `clients/${userId}/sleep`;
        const hydrationPath = `clients/${userId}/hydration`;

        const sleepQueryFlat = adminDb.collection(sleepPath).where('wakeUpDay', '==', startTimestamp).where('isNap', '==', false).limit(1);
        const sleepQueryNested = adminDb.collection(sleepPath).where('log.wakeUpDay', '==', startTimestamp).where('log.isNap', '==', false).limit(1);

        const hydrationQueryFlat = adminDb.collection(hydrationPath).where('entryDate', '>=', startTimestamp);
        const hydrationQueryNested = adminDb.collection(hydrationPath).where('log.entryDate', '>=', startTimestamp);

        const [sleepFlatSnap, sleepNestedSnap, hydrationFlatSnap, hydrationNestedSnap] = await Promise.all([
            sleepQueryFlat.get(),
            sleepQueryNested.get(),
            hydrationQueryFlat.get(),
            hydrationQueryNested.get(),
        ]);

        const sleepSnapshot = !sleepFlatSnap.empty ? sleepFlatSnap : sleepNestedSnap;

        let lastNightSleep = null;
        if (!sleepSnapshot.empty) {
            const sleepData = sleepSnapshot.docs[0].data();
            lastNightSleep = sleepData.log ? sleepData.log.duration : sleepData.duration;
        }

        const hydrationDocs = hydrationFlatSnap.docs.concat(hydrationNestedSnap.docs);
        const uniqueHydrationDocs = new Map();
        hydrationDocs.forEach(doc => uniqueHydrationDocs.set(doc.id, doc));

        let todaysHydration = 0;
        uniqueHydrationDocs.forEach(doc => {
            const data = doc.data();
            todaysHydration += (data.log ? data.log.amount : data.amount) || 0;
        });
        
        return {
            lastNightSleep,
            todaysHydration
        }

    } catch (error) {
        console.error("Error fetching contextual data: ", error);
        return null;
    }
}

interface CreateEventData {
    userId: string;
    workoutId: string;
    workoutName: string;
    startTime: Date;
    duration: number; // in minutes
}

export async function createCalendarEventAction(data: CreateEventData) {
    try {
        const { userId, workoutId, workoutName, startTime, duration } = data;

        if (!userId || !workoutId || !workoutName || !startTime) {
            return { success: false, error: "Missing required event data." };
        }

        const newEventRef = adminDb.collection('users').doc(userId).collection('events').doc();
        
        const newEvent = {
            title: workoutName,
            startTime: startTime.toISOString(),
            endTime: new Date(startTime.getTime() + duration * 60 * 1000).toISOString(),
            type: 'workout',
            relatedId: workoutId,
        };

        await newEventRef.set(newEvent);
        
        revalidatePath('/client/dashboard');

        return { success: true, data: { id: newEventRef.id, ...newEvent } };

    } catch (error: any) {
        console.error("Error creating calendar event:", error);
        return { success: false, error: "Failed to schedule workout. Please try again." };
    }
}

export async function deleteCalendarEvent(eventId: string) {
  if (!eventId) {
    return { success: false, error: 'Event ID is required.' };
  }

  try {
    await adminDb.collection('clientCalendar').doc(eventId).delete();
    revalidatePath('/client/dashboard');
    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return { success: false, error: 'Failed to delete the event.' };
  }
}

export async function updateWorkoutTime(eventId: string, newStartTime: Date) {
  if (!eventId || !newStartTime) {
    return { success: false, error: 'Event ID and new start time are required.' };
  }

  try {
    const eventRef = adminDb.collection('clientCalendar').doc(eventId);
    await eventRef.update({ start: Timestamp.fromDate(newStartTime) });
    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error("Error updating workout time:", error);
    return { success: false, error: 'Failed to update the workout time.' };
  }
}