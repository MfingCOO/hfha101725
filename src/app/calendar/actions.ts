'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';
import { subDays, addDays, isWithinInterval, format, startOfDay, endOfDay } from 'date-fns';
import { calculateDailySummaryForUser } from '@/services/summary-calculator'; 
import { revalidatePath } from 'next/cache';
import { Program, Workout, PerformanceLog } from '@/types/workout-program';
import { ScheduledEvent } from '@/types/event';
import { getMessaging } from 'firebase-admin/messaging';
import type { ClientProfile } from '@/types';

const ALL_DATA_COLLECTIONS = ['nutrition', 'hydration', 'activity', 'sleep', 'stress', 'measurements', 'protocol', 'planner', 'cravings'];

async function isUserCoach(userId: string): Promise<boolean> {
    if (!adminDb || !userId) return false;
    try {
        const clientSnap = await adminDb.collection('clients').doc(userId).get();
        return clientSnap.exists && clientSnap.data()?.role === 'coach';
    } catch (error) {
        console.error(`Error checking if user ${userId} is a coach:`, error);
        return false;
    }
}

async function getUserProfile(userId: string): Promise<ClientProfile | null> {
    if (!userId) return null;
    const userRef = adminDb.collection('clients').doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        return { uid: userSnap.id, ...userSnap.data() } as ClientProfile;
    }
    return null;
}

export async function addCoachFeedbackToAction(data: {
    entryId: string;
    clientId: string;
    coachId: string;
    feedbackType: 'like' | 'note';
    noteText?: string;
    pillar: string;
}) {
    const { entryId, clientId, coachId, feedbackType, noteText, pillar } = data;

    if (!ALL_DATA_COLLECTIONS.includes(pillar)) {
        return { success: false, error: 'Invalid pillar specified.' };
    }
    
    if (!(await isUserCoach(coachId))) {
        return { success: false, error: 'Unauthorized: User is not a coach.' };
    }

    try {
        const coachProfile = await getUserProfile(coachId);
        if (!coachProfile) {
            return { success: false, error: 'Coach profile not found.' };
        }

        const entryRef = adminDb.collection(`clients/${clientId}/${pillar}`).doc(entryId);
        const doc = await entryRef.get();

        if (!doc.exists) {
            return { success: false, error: 'Log entry not found.' };
        }

        if (feedbackType === 'like') {
            const currentLike = doc.data()?.coachLike;
            if (currentLike && currentLike.coachId === coachId) {
                await entryRef.update({ coachLike: FieldValue.delete() });
            } else {
                await entryRef.update({
                    'coachLike.coachId': coachId,
                    'coachLike.timestamp': FieldValue.serverTimestamp(),
                });
            }
        } else if (feedbackType === 'note' && noteText) {
            await entryRef.update({
                'coachNote.coachId': coachId,
                'coachNote.coachName': coachProfile.fullName,
                'coachNote.text': noteText,
                'coachNote.timestamp': FieldValue.serverTimestamp(),
            });
        } else {
            return { success: false, error: 'Invalid feedback type or missing note text.' };
        }
        
        const clientProfile = await getUserProfile(clientId);
        if (clientProfile?.fcmTokens && clientProfile.fcmTokens.length > 0) {
            const entryDoc = await entryRef.get();
            const entryData = entryDoc.data();
            const entryDate = entryData?.entryDate ? entryData.entryDate.toDate() : new Date();

            const message = {
                notification: {
                    title: 'New Feedback from Your Coach!',
                    body: feedbackType === 'like' 
                        ? `${coachProfile.fullName} liked your ${pillar} entry.`
                        : `${coachProfile.fullName} left a note on your ${pillar} entry.`,
                },
                tokens: clientProfile.fcmTokens,
                data: {
                    notificationType: 'coach_feedback',
                    entryId: entryId,
                    pillar: pillar,
                    entryDate: format(entryDate, 'yyyy-MM-dd')
                },
            };
            await getMessaging().sendEachForMulticast(message);
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error in addCoachFeedbackToAction: ", error);
        return { success: false, error: error.message };
    }
}

export async function triggerSummaryRecalculation(userId: string, date: string, userTimezone: string, timezoneOffset: number) {
    if (!userId || !date) {
        return { success: false, error: "User ID and date are required." };
    }
    try {
        return await calculateDailySummaryForUser(userId, date, userTimezone, timezoneOffset);
    } catch (error: any) {
        console.error(`[Action] CRITICAL ERROR in triggerSummaryRecalculation for user ${userId} on date ${date}:`, error);
        return { success: false, error: error.message };
    }
}

// FINAL FIX: This is the robust serialization function that handles all Timestamp formats recursively.
function serializeTimestamps(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(item => serializeTimestamps(item));
    }
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            newObj[key] = serializeTimestamps(data[key]);
        }
    }
    return newObj;
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
        return { success: false, error: "User ID is required." };
    }
     if (userTimezone === undefined || timezoneOffset === undefined) {
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
                    nestedQuery.get()
                ]);

                const docs = new Map<string, DocumentSnapshot>();
                flatSnapshot.docs.forEach(doc => docs.set(doc.id, doc));
                nestedSnapshot.docs.forEach(doc => docs.set(doc.id, doc));

                return Array.from(docs.values()).map(doc => ({ ...unnestLogData(doc), pillar: collectionName }));
            } catch (error) {
                console.error(`Failed to fetch data for a collection ${collectionName}:`, error);
                return [];
            }
        });

        const coachAppointmentsPromise = adminDb.collection('coachCalendar').where('clientId', '==', userId).where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();
        const clientCalendarEventsPromise = adminDb.collection('clientCalendar').where('userId', '==', userId).where('startTime', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('startTime', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();
        const liveEventsPromise = adminDb.collection('clientCalendar').where('userId', '==', userId).where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();

        const [summarySnap, personalLogsNested, coachAppointmentsSnap, clientCalendarEventsSnap, liveEventsSnap] = await Promise.all([
            summaryPromise,
            Promise.all(personalLogPromises),
            coachAppointmentsPromise,
            clientCalendarEventsPromise,
            liveEventsPromise
        ]);
    
        const coachAppointments = coachAppointmentsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: 'appointment', entryDate: doc.data().start }));
        const clientCalendarEvents = clientCalendarEventsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: doc.data().type || 'live-event', entryDate: doc.data().startTime }));
        const liveEvents = liveEventsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: doc.data().type || 'live-event', entryDate: doc.data().start }));

        const allEntriesRaw = (personalLogsNested as any).flat().concat(coachAppointments as any).concat(clientCalendarEvents as any).concat(liveEvents as any).filter(Boolean);

        const finalEntries = allEntriesRaw.filter(entry => {
            const getJSDate = (d: any) => {
                if (!d) return null;
                if (d.seconds) return new Date(d.seconds * 1000); 
                if (typeof d === 'string') return new Date(d);
                return null;
            }

            if (entry.pillar === 'sleep') {
                const wakeUpDay = getJSDate(entry.wakeUpDay);
                if (wakeUpDay && wakeUpDay.getTime() >= filterRangeStartUTC.getTime() && wakeUpDay.getTime() <= filterRangeEndUTC.getTime()) return true;
                const entryDate = getJSDate(entry.entryDate);
                return entry.isNap && entryDate && isWithinInterval(entryDate, { start: filterRangeStartUTC, end: filterRangeEndUTC });
            }
            if (entry.pillar === 'planner') {
                const indulgenceDate = getJSDate(entry.indulgenceDate);
                return indulgenceDate && isWithinInterval(indulgenceDate, { start: filterRangeStartUTC, end: filterRangeEndUTC });
            }
            const entryDate = getJSDate(entry.entryDate || entry.start || entry.startTime);
            return entryDate && isWithinInterval(entryDate, { start: filterRangeStartUTC, end: filterRangeEndUTC });
        });
        
        finalEntries.sort((a: any, b: any) => {
             const getJSDate = (d: any) => d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
             const dateA = getJSDate(a.indulgenceDate || a.entryDate || a.wakeUpDay || a.start || a.startTime);
             const dateB = getJSDate(b.indulgenceDate || b.entryDate || b.wakeUpDay || b.start || b.startTime);
             return dateA.getTime() - dateB.getTime();
        });

        const displayEntries = finalEntries.map(entry => {
            if (entry.title) return entry;
            let newTitle = 'Logged Entry';
            switch (entry.pillar) {
                case 'nutrition': newTitle = entry.mealType || entry.name || 'Nutrition Entry'; break;
                case 'activity': newTitle = entry.name || 'Activity'; break;
                case 'sleep': newTitle = entry.isNap ? 'Nap' : 'Sleep'; break;
                case 'hydration': newTitle = `Hydration: ${entry.amount}${entry.unit || 'oz'}`; break;
                case 'stress': newTitle = 'Stress Log'; break;
                case 'measurements': newTitle = 'Measurement'; break;
                case 'planner': newTitle = entry.name || 'Planned Indulgence'; break;
                case 'cravings': newTitle = 'Craving/Binge Log'; break;
                default: if (entry.name) newTitle = entry.name; break;
            }
            return { ...entry, title: newTitle };
        });

        const serializableData = displayEntries.map(serializeTimestamps);
        const summaryData = summarySnap.exists ? serializeTimestamps(summarySnap.data()) : { calories: 0, hydration: 0, sleep: 0, activity: 0, upf: 0, allNutrients: {} };

        return { success: true, data: serializableData, summary: summaryData };

    } catch (e: any) {
        console.error("CRITICAL ERROR in getCalendarDataForDay: ", e);
        return { success: false, data: [], error: e.message || "An unknown server error occurred." };
    }
}

async function getWorkoutAndProgramDetails(workoutId: string, programId?: string): Promise<{ workout: Workout | null, program: Program | null, weekName?: string, dayNumber?: number }> {
    if (!workoutId) return { workout: null, program: null };

    let workout: Workout | null = null;
    let program: Program | null = null;
    let weekName: string | undefined;
    let dayNumber: number | undefined;

    const workoutDoc = await adminDb.collection('workouts').doc(workoutId).get();
    if (workoutDoc.exists) {
        workout = { id: workoutDoc.id, ...workoutDoc.data() } as Workout;
    } else {
        return { workout: null, program: null };
    }

    if (programId) {
        const programDoc = await adminDb.collection('programs').doc(programId).get();
        if (programDoc.exists) {
            program = { id: programDoc.id, ...programDoc.data() } as Program;
            
            for (const [weekIndex, week] of (program.weeks || []).entries()) {
                const dayIndex = (week.workoutIds || []).indexOf(workoutId);
                if (dayIndex !== -1) {
                    weekName = `Week ${weekIndex + 1}`;
                    dayNumber = dayIndex + 1;
                    break; 
                }
            }
        }
    }

    return { workout, program, weekName, dayNumber };
}

export async function createCalendarEventAction(data: {
    userId: string;
    programId?: string; 
    workoutId: string;
    startTime: Date;
    duration: number;
    isCompleted?: boolean;
}) {
    try {
        const { userId, programId, workoutId, startTime, duration, isCompleted = false } = data;

        if (!userId || !workoutId || !startTime) {
            return { success: false, error: "Missing required event data." };
        }

        const { workout, weekName, dayNumber } = await getWorkoutAndProgramDetails(workoutId, programId);
        if (!workout) {
            return { success: false, error: "Workout not found." };
        }

        const finalTitle = (weekName && dayNumber) 
            ? `${weekName}, Day ${dayNumber}: ${workout.name}` 
            : workout.name;

        const newEventRef = adminDb.collection('clientCalendar').doc();
        const newEvent = {
            id: newEventRef.id,
            userId: userId,
            title: finalTitle,
            startTime: Timestamp.fromDate(startTime),
            endTime: Timestamp.fromDate(new Date(startTime.getTime() + duration * 60 * 1000)),
            type: 'workout',
            relatedId: workoutId,
            isCompleted: isCompleted,
            duration: duration,
            programId: programId || null, 
        };

        await newEventRef.set(newEvent);
        
        revalidatePath('/calendar');
        revalidatePath('/client/dashboard');

        return { success: true, data: { ...newEvent, id: newEventRef.id, startTime: newEvent.startTime.toDate().toISOString(), endTime: newEvent.endTime.toDate().toISOString() } };

    } catch (error: any) {
        console.error("Error creating calendar event:", error);
        return { success: false, error: "Failed to schedule workout. Please try again." };
    }
}

export async function completeWorkoutAction(data: {
    userId: string;
    workoutId: string;
    startTime: Date;
    duration: number;
    performanceLog: PerformanceLog;
    programId?: string;
    calendarEventId?: string;
    timezone?: string; 
    timezoneOffset?: number; 
}) {
    const { userId, workoutId, startTime, duration, calendarEventId, timezone, timezoneOffset, performanceLog } = data;
    if (!userId || !workoutId || !startTime || !performanceLog) return { success: false, error: "Missing required workout completion data." };

    const batch = adminDb.batch();

    try {
        let effectiveProgramId = data.programId;

        if (!effectiveProgramId && calendarEventId) {
            const eventRef = adminDb.collection('clientCalendar').doc(calendarEventId);
            const eventDoc = await eventRef.get();
            if (eventDoc.exists) {
                effectiveProgramId = eventDoc.data()?.programId || null;
            }
        }

        const { workout, weekName, dayNumber } = await getWorkoutAndProgramDetails(workoutId, effectiveProgramId);
        if (!workout) return { success: false, error: "Workout not found." };

        const finalName = (weekName && dayNumber) ? `${weekName}, Day ${dayNumber}: ${workout.name}` : workout.name;
        
        const logRef = adminDb.collection('workout_logs').doc();
        batch.set(logRef, { ...performanceLog, id: logRef.id });
        
        const activityRef = adminDb.collection(`clients/${userId}/activity`).doc();
        batch.set(activityRef, {
            id: activityRef.id,
            entryDate: Timestamp.fromDate(startTime),
            name: finalName,      
            type: 'workout',
            duration: duration,    
            calories: (workout as any).calories || null,
            relatedId: logRef.id, 
            programId: effectiveProgramId || null,
            workoutId: workoutId, 
            logId: logRef.id,
            notes: performanceLog.notes || '',
        });

        if (calendarEventId) {
            const eventToDeleteRef = adminDb.collection('clientCalendar').doc(calendarEventId);
            batch.delete(eventToDeleteRef);
        }

        await batch.commit();

        try {
            const date = format(startTime, 'yyyy-MM-dd');
            if (timezone && timezoneOffset !== undefined) {
                await calculateDailySummaryForUser(userId, date, timezone, timezoneOffset);
            } else {
                console.warn(`[Action] Missing timezone for user ${userId} on workout completion. Summary might be stale.`);
            }
        } catch (summaryError) {
            console.error(`[Action] Non-critical error: Daily summary calculation failed for user ${userId}.`, summaryError);
        }

        try {
            revalidatePath('/calendar');
            revalidatePath('/client/dashboard');
        } catch (revalError) {
            console.warn("[Action] Non-critical error: revalidatePath failed but workout was logged successfully.", revalError);
        }

        return { success: true };

    } catch (error: any) {
        console.error("CRITICAL Error in completeWorkoutAction:", error);
        return { success: false, error: "Failed to complete workout. Please try again." };
    }
}


export async function getTodaysContextualData(userId: string) {
    if (!userId) return null;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
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
    const doc = await eventRef.get();
    if(!doc.exists) {
        return { success: false, error: 'Event not found.' };
    }
    const eventData = doc.data() as ScheduledEvent;
    const duration = eventData.duration || 60; // Default to 60 mins if no duration
    const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000);

    await eventRef.update({ 
        startTime: Timestamp.fromDate(newStartTime),
        endTime: Timestamp.fromDate(newEndTime)
     });
    revalidatePath('/calendar');
    return { success: true };
  } catch (error) {
    console.error("Error updating workout time:", error);
    return { success: false, error: 'Failed to update the workout time.' };
  }
}

export async function getCalendarDataForRange(userId: string, startDate: string, endDate: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!userId || !startDate || !endDate) {
        return { success: false, error: "User ID, start date, and end date are required." };
    }

    const filterRangeStart = startOfDay(new Date(startDate));
    const filterRangeEnd = endOfDay(new Date(endDate));

    const firestoreQueryStartUTC = subDays(filterRangeStart, 1);
    const firestoreQueryEndUTC = addDays(filterRangeEnd, 1);

    try {
        const personalLogPromises = ALL_DATA_COLLECTIONS.map(async (collectionName) => {
            const collectionPath = `clients/${userId}/${collectionName}`;
            const dateField = collectionName === 'planner' ? 'indulgenceDate' : 'entryDate';
            const nestedDateField = collectionName === 'planner' ? 'log.indulgenceDate' : 'log.entryDate';
            
            const flatQuery = adminDb.collection(collectionPath).where(dateField, '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where(dateField, '<=', Timestamp.fromDate(firestoreQueryEndUTC));
            const nestedQuery = adminDb.collection(collectionPath).where(nestedDateField, '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where(nestedDateField, '<=', Timestamp.fromDate(firestoreQueryEndUTC));

            const [flatSnapshot, nestedSnapshot] = await Promise.all([flatQuery.get(), nestedQuery.get()]);
            const docs = new Map<string, DocumentSnapshot>();
            flatSnapshot.docs.forEach(doc => docs.set(doc.id, doc));
            nestedSnapshot.docs.forEach(doc => docs.set(doc.id, doc));
            return Array.from(docs.values()).map(doc => ({ ...unnestLogData(doc), pillar: collectionName }));
        });

        const coachAppointmentsPromise = adminDb.collection('coachCalendar').where('clientId', '==', userId).where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();
        const clientCalendarEventsPromise = adminDb.collection('clientCalendar').where('userId', '==', userId).where('startTime', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('startTime', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();
        const liveEventsPromise = adminDb.collection('clientCalendar').where('userId', '==', userId).where('start', '>=', Timestamp.fromDate(firestoreQueryStartUTC)).where('start', '<=', Timestamp.fromDate(firestoreQueryEndUTC)).get();

        const [personalLogsNested, coachAppointmentsSnap, clientCalendarEventsSnap, liveEventsSnap] = await Promise.all([
            Promise.all(personalLogPromises),
            coachAppointmentsPromise,
            clientCalendarEventsPromise,
            liveEventsPromise
        ]);
    

        const coachAppointments = coachAppointmentsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: 'appointment', entryDate: doc.data().start }));
        const clientCalendarEvents = clientCalendarEventsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: doc.data().type || 'live-event', entryDate: doc.data().startTime }));
        const liveEvents = liveEventsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, pillar: doc.data().type || 'live-event', entryDate: doc.data().start }));

        const allEntriesRaw = (personalLogsNested as any).flat().concat(coachAppointments as any).concat(clientCalendarEvents as any).concat(liveEvents as any).filter(Boolean);

        const finalEntries = allEntriesRaw.filter(entry => {
            const getJSDate = (d: any) => d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
            if (entry.pillar === 'sleep') {
                const wakeUpDay = getJSDate(entry.wakeUpDay);
                if (wakeUpDay && wakeUpDay.getTime() >= filterRangeStart.getTime() && wakeUpDay.getTime() <= filterRangeEnd.getTime()) return true;
                const entryDate = getJSDate(entry.entryDate);
                return entry.isNap && entryDate && isWithinInterval(entryDate, { start: filterRangeStart, end: filterRangeEnd });
            }
            if (entry.pillar === 'planner') {
                const indulgenceDate = getJSDate(entry.indulgenceDate);
                return indulgenceDate && isWithinInterval(indulgenceDate, { start: filterRangeStart, end: filterRangeEnd });
            }
            const entryDate = getJSDate(entry.entryDate || entry.start || entry.startTime);
            return entryDate && isWithinInterval(entryDate, { start: filterRangeStart, end: filterRangeEnd });
        });
        
        finalEntries.sort((a: any, b: any) => {
             const getJSDate = (d: any) => d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
             const dateA = getJSDate(a.indulgenceDate || a.entryDate || a.wakeUpDay || a.start || a.startTime);
             const dateB = getJSDate(b.indulgenceDate || b.entryDate || b.wakeUpDay || b.start || b.startTime);
             return dateA.getTime() - dateB.getTime();
        });

        const displayEntries = finalEntries.map(entry => {
            if (entry.title) return entry;
            let newTitle = 'Logged Entry';
            switch (entry.pillar) {
                case 'nutrition': newTitle = entry.mealType || entry.name || 'Nutrition Entry'; break;
                case 'activity': newTitle = entry.name || 'Activity'; break;
                case 'sleep': newTitle = entry.isNap ? 'Nap' : 'Sleep'; break;
                case 'hydration': newTitle = `Hydration: ${entry.amount}${entry.unit || 'oz'}`; break;
                case 'stress': newTitle = 'Stress Log'; break;
                case 'measurements': newTitle = 'Measurement'; break;
                case 'planner': newTitle = entry.name || 'Planned Indulgence'; break;
                case 'cravings': newTitle = 'Craving/Binge Log'; break;
                default: if (entry.name) newTitle = entry.name; break;
            }
            return { ...entry, title: newTitle };
        });

        const serializableData = displayEntries.map(serializeTimestamps);
        return { success: true, data: serializableData };

    } catch (e: any) {
        console.error("CRITICAL ERROR in getCalendarDataForRange: ", e);
        return { success: false, data: [], error: e.message || "An unknown server error occurred." };
    }
}
