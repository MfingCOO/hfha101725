'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { ClientProfile } from '@/types';
import type { CalendarEvent } from '@/types/event';
import { revalidatePath } from 'next/cache';

const SERVER_ERROR = { success: false, error: "Server configuration error." };

// Helper to get a robust user profile from any collection
async function getUserProfile_Admin_Robust(userId: string): Promise<ClientProfile | null> {
    if (!adminDb || !userId) return null;
    try {
        const clientRef = adminDb.collection('clients').doc(userId);
        const clientSnap = await clientRef.get();
        if (clientSnap.exists) {
            return { uid: userId, ...clientSnap.data() } as ClientProfile;
        }

        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();
        if (userProfileSnap.exists) {
            console.warn(`User ${userId} found in legacy 'userProfiles' collection.`);
            return { uid: userId, ...userProfileSnap.data() } as ClientProfile;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching robust profile for user ${userId}:`, error);
        return null;
    }
}

// Zod schemas for validation
const EventInputSchema = z.object({
    id: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    start: z.string(), // ISO string
    end: z.string(),   // ISO string
    isPersonal: z.boolean().optional(),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    coachId: z.string(),
    coachName: z.string(),
    notes: z.string().optional(),
    isCoachBooking: z.boolean().optional(),
    type: z.string().optional(),
});

const LiveEventSchema = z.object({
  eventId: z.string().optional(), // Added to support updates
  title: z.string(),
  description: z.string(),
  start: z.string(), // ISO string
  end: z.string(),   // ISO string
  coachId: z.string(),
  coachName: z.string(),
  maxParticipants: z.number(),
});

// Action to create or update a Live Event specifically
export async function createLiveEvent(eventData: z.infer<typeof LiveEventSchema>): Promise<{ success: boolean; error?: string }> {
    if (!adminDb) return SERVER_ERROR;

    try {
        const parsedEvent = LiveEventSchema.parse(eventData);
        const eventForDb: any = {
            ...parsedEvent,
            type: 'live-event',
            start: Timestamp.fromDate(new Date(parsedEvent.start)),
            end: Timestamp.fromDate(new Date(parsedEvent.end)),
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Remove eventId from the body if it exists so it's not stored as a field
        const { eventId, ...finalPayload } = eventForDb;

        if (eventId) {
            await adminDb.collection('calendarEvents').doc(eventId).update(finalPayload);
        } else {
            await adminDb.collection('calendarEvents').add({
                ...finalPayload,
                attendees: [],
                attendeeCount: 0,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        revalidatePath('/coach/events');
        return { success: true };
    } catch (error: any) {
        console.error('Error handling live event:', error);
        return { success: false, error: error.message };
    }
}

// Action to update existing live events (Mapped from UI calls)
export async function updateLiveEvent(eventData: any): Promise<{ success: boolean; eventId?: string; error?: string; }> {
    // If the UI sends "eventId" instead of "id", we map it to createLiveEvent logic
    return createLiveEvent(eventData);
}

// Action to get events for a specific coach
export async function getCoachEvents(coachId: string): Promise<{ success: boolean; data?: any[]; error?: string; }> {
    if (!adminDb) return SERVER_ERROR;

    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const eventsQuery = adminDb.collection('calendarEvents')
            .where('coachId', '==', coachId)
            .where('start', '>=', Timestamp.fromDate(sevenDaysAgo))
            .orderBy('start', 'asc');

        const snapshot = await eventsQuery.get();
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                start: (data.start as Timestamp).toDate().toISOString(),
                end: (data.end as Timestamp).toDate().toISOString(),
            };
        });

        return { success: true, data: events };
    } catch (error: any) {
        console.error("Error fetching coach events: ", error);
        return { success: false, error: error.message };
    }
}

// Action to delete a calendar event
export async function deleteCalendarEventAction(eventId: string): Promise<{ success: boolean; error?: string; }> {
    if (!adminDb) return SERVER_ERROR;
    try {
        await adminDb.collection('calendarEvents').doc(eventId).delete();
        revalidatePath('/coach/dashboard');
        revalidatePath('/client/dashboard');
        revalidatePath('/coach/events');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting calendar event:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteLiveEvent(eventId: string): Promise<{ success: boolean, error?: string}> {
    return deleteCalendarEventAction(eventId);
}

export async function getLiveEvents(coachId: string): Promise<{ success: boolean, data?: any[], error?: string}> {
     if (!adminDb) return SERVER_ERROR;

    try {
        const query = adminDb.collection('calendarEvents')
            .where('type', '==', 'live-event')
            .where('coachId', '==', coachId)
            .orderBy('start', 'desc');
        
        const snapshot = await query.get();
        if (snapshot.empty) return { success: true, data: [] };
        
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                eventTimestamp: (data.start as Timestamp).toDate().toISOString(), // Map back to UI expectation
                start: (data.start as Timestamp).toDate().toISOString(),
                end: (data.end as Timestamp).toDate().toISOString(),
            };
        });

        return { success: true, data: events };
    } catch (error: any) {
        console.error('Error fetching live events:', error);
        return { success: false, error: error.message };
    }
}

export async function getLiveEventWithAttendees(eventId: string): Promise<{ success: boolean, data?: any, error?: string}> {
    if (!adminDb) return SERVER_ERROR;

    try {
        const eventRef = adminDb.collection('calendarEvents').doc(eventId);
        const eventDoc = await eventRef.get();

        if (!eventDoc.exists) return { success: false, error: 'Event not found' };

        const eventData = eventDoc.data() as any;
        const attendeeIds = eventData.attendees || [];
        const attendees: ClientProfile[] = [];

        if (attendeeIds.length > 0) {
            const results = await Promise.all(attendeeIds.map((id: string) => getUserProfile_Admin_Robust(id)));
            results.forEach(profile => { if (profile) attendees.push(profile); });
        }
        
        return { 
            success: true, 
            data: {
                ...eventData,
                id: eventDoc.id,
                start: (eventData.start as Timestamp).toDate().toISOString(),
                end: (eventData.end as Timestamp).toDate().toISOString(),
                attendeeDetails: attendees
            } 
        };
    } catch (error: any) {
        console.error('Error fetching live event with attendees:', error);
        return { success: false, error: error.message };
    }
}

export async function signUpForEvent(input: { eventId: string; userId: string; }): Promise<{ success: boolean; error?: string; }> {
    if (!adminDb) return SERVER_ERROR;

    try {
        const { eventId, userId } = input;
        const eventRef = adminDb.collection('calendarEvents').doc(eventId);

        await adminDb.runTransaction(async (transaction) => {
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists) throw new Error("Event not found.");

            const eventData = eventDoc.data();
            if (eventData?.attendees && eventData.attendees.includes(userId)) return;

            transaction.update(eventRef, {
                attendees: FieldValue.arrayUnion(userId),
                attendeeCount: FieldValue.increment(1)
            });
        });

        revalidatePath('/client/dashboard');
        revalidatePath('/coach/events');
        return { success: true };
    } catch (error: any) {
        console.error('Error signing up for event:', error);
        return { success: false, error: error.message };
    }
}

export async function getUpcomingLiveEvent(userId: string): Promise<{ success: boolean; data?: any; error?: string; }> {
    if (!adminDb) return SERVER_ERROR;

    try {
        const now = Timestamp.now();
        const userProfile = await getUserProfile_Admin_Robust(userId);

        if (!userProfile || !userProfile.coachId) return { success: true, data: null };

        const query = adminDb.collection("calendarEvents")
            .where("coachId", "==", userProfile.coachId)
            .where("type", "==", "live-event")
            .where("start", ">=", now)
            .orderBy("start", "asc")
            .limit(1);

        const snapshot = await query.get();
        if (snapshot.empty) return { success: true, data: null };

        const eventDoc = snapshot.docs[0];
        const eventData = eventDoc.data();

        return {
            success: true,
            data: {
                id: eventDoc.id,
                ...eventData,
                start: (eventData.start as Timestamp).toDate().toISOString(),
                end: (eventData.end as Timestamp).toDate().toISOString(),
            }
        };
    } catch (error: any) {
        console.error("Error fetching upcoming live event:", error);
        return { success: false, error: error.message };
    }
}