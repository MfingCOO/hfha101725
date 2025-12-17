'use server';

import { admin, db as adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp, FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import { subDays, set } from 'date-fns';
import type { UserProfile, ClientProfile, SiteSettings, LiveEvent } from '@/types';

// Zod schema for input validation
const LiveEventInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long.'),
  description: z.string().min(10, 'Description must be at least 10 characters long.'),
  eventTimestamp: z.date(),
  durationMinutes: z.number().min(1, 'Duration must be at least 1 minute.'),
  coachId: z.string(),
  attachVideoLink: z.boolean().default(false),
});

type LiveEventInput = z.infer<typeof LiveEventInputSchema>;

function serializeData(docData: any): any {
    if (!docData) return docData;
    if (Array.isArray(docData)) {
        return docData.map(item => serializeData(item));
    }
    if (typeof docData !== 'object') return docData;

    const newObject: { [key: string]: any } = {};
    for (const key in docData) {
        if (Object.prototype.hasOwnProperty.call(docData, key)) {
            const value = docData[key];
            if (value instanceof Timestamp) {
                newObject[key] = value.toDate().toISOString();
            } else if (value && typeof value.toDate === 'function') { // Firestore Timestamp-like objects
                 newObject[key] = value.toDate().toISOString();
            } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                newObject[key] = serializeData(value);
            } else {
                newObject[key] = value;
            }
        }
    }
    return newObject;
}


/**
 * Creates a new live event, and also adds a corresponding event to the coach's calendar.
 * This ensures data consistency and prevents scheduling conflicts.
 */
export async function createLiveEvent(input: LiveEventInput): Promise<{ success: boolean; error?: string; }> {
  const validation = LiveEventInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  const { title, description, eventTimestamp, durationMinutes, coachId, attachVideoLink } = validation.data;

  const batch = adminDb.batch();
  const liveEventRef = adminDb.collection('liveEvents').doc();
  const calendarEventRef = adminDb.collection('coachCalendar').doc();

  try {
    let videoConferenceLink: string | null = null;

    if (attachVideoLink) {
      const settingsDocRef = adminDb.collection('siteSettings').doc('v1');
      const settingsSnap = await settingsDocRef.get();
      if (settingsSnap.exists) {
        const siteSettings = settingsSnap.data() as SiteSettings;
        if (siteSettings.videoCallLink) {
          videoConferenceLink = siteSettings.videoCallLink;
        }
      }
    }

    const eventDate = new Date(eventTimestamp);
    const eventDateForDeadline = new Date(eventTimestamp);
    eventDateForDeadline.setUTCHours(0, 0, 0, 0);

    const liveEventData = {
      title,
      description,
      coachId,
      eventTimestamp: Timestamp.fromDate(eventDate),
      entryDate: Timestamp.fromDate(eventDate),
      durationMinutes,
      videoConferenceLink,
      signUpDeadline: Timestamp.fromDate(eventDateForDeadline),
      attendees: [],
      createdAt: FieldValue.serverTimestamp(),
    };

    batch.set(liveEventRef, liveEventData);

    const calendarEventData = {
        coachId,
        title: `[Live Event] ${title}`,
        start: Timestamp.fromDate(eventDate),
        entryDate: Timestamp.fromDate(eventDate),
        end: Timestamp.fromDate(new Date(eventDate.getTime() + durationMinutes * 60000)),
        description: `This is a placeholder for the live event: "${title}". Manage attendees in the Events section.`,
        isPersonal: true, 
        videoCallLink: videoConferenceLink,
    };

    batch.set(calendarEventRef, calendarEventData);
    await batch.commit();

    return { success: true };

  } catch (error: any) {
    console.error('Error creating live event:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}

const SignUpInputSchema = z.object({
  eventId: z.string(),
  userId: z.string(),
});

export async function signUpForEvent(input: z.infer<typeof SignUpInputSchema>): Promise<{ success: boolean; error?: string; }> {
  const validation = SignUpInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid input." };
  }

  const { eventId, userId } = validation.data;

  const liveEventRef = adminDb.collection('liveEvents').doc(eventId);
  const userProfileRef = adminDb.collection('userProfiles').doc(userId);
  const clientProfileRef = adminDb.collection('clients').doc(userId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const [liveEventDoc, userProfileDoc, clientProfileDoc] = await Promise.all([
        transaction.get(liveEventRef),
        transaction.get(userProfileRef),
        transaction.get(clientProfileRef)
      ]);

      if (!liveEventDoc.exists) throw new Error("Event not found.");
      if (!userProfileDoc.exists) throw new Error("User profile not found.");
      if (!clientProfileDoc.exists) throw new Error("Client profile not found. Cannot verify subscription tier.");

      const liveEvent = liveEventDoc.data() as LiveEvent;

      const now = Timestamp.now();
      if (now > (liveEvent.signUpDeadline as any)) {
        throw new Error("The sign-up deadline for this event has passed.");
      }
      
      if (liveEvent.attendees.includes(userId)) {
          return; // Gracefully exit if already signed up
      }

      transaction.update(liveEventRef, { attendees: FieldValue.arrayUnion(userId) });
      
      const eventTimestampSource = liveEvent.eventTimestamp as any;
      if (!eventTimestampSource || typeof eventTimestampSource.toDate !== 'function') {
          throw new Error('Cannot sign up for event: The source event timestamp is not valid.');
      }
      const eventDate = eventTimestampSource.toDate();

      const clientCalendarEventData = {
          userId: userId,
          title: liveEvent.title,
          start: Timestamp.fromDate(eventDate),
          entryDate: Timestamp.fromDate(eventDate),
          end: Timestamp.fromDate(new Date(eventDate.getTime() + Number(liveEvent.durationMinutes) * 60000)),
          description: `You are registered for the live event: "${liveEvent.title}".\n\n${liveEvent.description}`,
          type: 'live-event',
          videoCallLink: liveEvent.videoConferenceLink,
          reminders: [ { method: 'popup', minutes: 30 } ]
      };

      transaction.set(adminDb.collection('clientCalendar').doc(), clientCalendarEventData);
    });

    return { success: true };

  } catch (error: any) {
    console.error(`Error signing up user ${userId} for event ${eventId}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}

export async function getLiveEvents(): Promise<{ success: boolean; data?: any[]; error?: string; }> {
    try {
        const now = Timestamp.now();
        const eventsQuery = adminDb.collection('liveEvents').where('eventTimestamp', '>=', now).orderBy('eventTimestamp', 'asc');
        const eventsSnapshot = await eventsQuery.get();

        if (eventsSnapshot.empty) {
            return { success: true, data: [] };
        }
        
        const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveEvent[];
        const allAttendeeIds = [...new Set(events.flatMap(event => event.attendees))];

        let attendeeProfiles: { [uid: string]: UserProfile } = {};

        if (allAttendeeIds.length > 0) {
            const MAX_IDS_PER_QUERY = 30; 
            for (let i = 0; i < allAttendeeIds.length; i += MAX_IDS_PER_QUERY) {
                const chunk = allAttendeeIds.slice(i, i + MAX_IDS_PER_QUERY);
                if (chunk.length > 0) {
                    const q = adminDb.collection('userProfiles').where(FieldPath.documentId(), 'in', chunk);
                    const snapshot = await q.get();
                    snapshot.forEach(doc => {
                        attendeeProfiles[doc.id] = doc.data() as UserProfile;
                    });
                }
            }
        }
        
        const eventsWithAttendees = events.map(event => ({
            ...event,
            attendeeDetails: event.attendees.map(uid => attendeeProfiles[uid]).filter(Boolean) 
        }));

        return { success: true, data: serializeData(eventsWithAttendees) };

    } catch (error: any) {
        console.error("Error fetching live events:", error);
        return { success: false, error: error.message };
    }
}


export async function getUpcomingLiveEvent(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const now = Timestamp.now();
        const eventsQuery = adminDb.collection('liveEvents')
            .where('eventTimestamp', '>=', now)
            .orderBy('eventTimestamp', 'asc')
            .limit(1);

        const eventsSnapshot = await eventsQuery.get();

        if (eventsSnapshot.empty) {
            return { success: true, data: undefined };
        }

        const upcomingEvent = { id: eventsSnapshot.docs[0].id, ...eventsSnapshot.docs[0].data() };
        
        return { success: true, data: serializeData(upcomingEvent) };

    } catch (error: any) {
        console.error("Error fetching upcoming live event:", error);
        return { success: false, error: error.message };
    }
}

const UpdateLiveEventInputSchema = z.object({
  eventId: z.string(),
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  eventTimestamp: z.date().optional(),
  durationMinutes: z.number().min(1).optional(),
});

export async function updateLiveEvent(input: z.infer<typeof UpdateLiveEventInputSchema>): Promise<{ success: boolean; error?: string; }> {
  const validation = UpdateLiveEventInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }
  
  const { eventId, ...updateData } = validation.data;

  if (Object.keys(updateData).length === 0) {
    return { success: true }; // No data to update
  }

  const eventRef = adminDb.collection('liveEvents').doc(eventId);

  try {
    const payload: { [key: string]: any } = { ...updateData };
    if (updateData.eventTimestamp) {
        payload.eventTimestamp = Timestamp.fromDate(updateData.eventTimestamp);
        payload.entryDate = Timestamp.fromDate(updateData.eventTimestamp);
    }
    await eventRef.update(payload);
    return { success: true };
  } catch (error: any) {
    console.error(`Error updating live event ${eventId}:`, error);
    return { success: false, error: 'Failed to update event.' };
  }
}

const DeleteLiveEventInputSchema = z.object({
  eventId: z.string(),
});

export async function deleteLiveEvent(input: z.infer<typeof DeleteLiveEventInputSchema>): Promise<{ success: boolean; error?: string; }> {
  const validation = DeleteLiveEventInputSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid input." };
  }
  
  const { eventId } = validation.data;
  const eventRef = adminDb.collection('liveEvents').doc(eventId);

  try {
    await eventRef.delete();
    // Note: This doesn't delete the associated calendar event. A full implementation would also delete the calendar placeholder.
    return { success: true };
  } catch (error: any) {
    console.error(`Error deleting live event ${eventId}:`, error);
    return { success: false, error: 'Failed to delete event.' };
  }
}
