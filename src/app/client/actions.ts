'use server';

import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Program, UserProgram } from '@/types/workout-program';
import { ScheduledEvent } from '@/types/event';
import { ActionResponse } from '@/types/action-response';
import { Timestamp } from 'firebase-admin/firestore';

export async function getClientProgramsAction(): Promise<ActionResponse<Program[]>> {
  try {
    const snapshot = await firestore.collection('programs').orderBy('name').get();
    if (snapshot.empty) {
      return { success: true, data: [] };
    }
    // CORRECTED: Removed the faulty logic that tried to access a `workouts` property that does not exist.
    // This was causing the server to crash.
    const programs = snapshot.docs.map(doc => {
        const program = doc.data() as Program;
        program.id = doc.id;
        return program;
    });
    return { success: true, data: programs };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch workout programs." };
  }
}

export async function getProgramDetailsAction(programId: string): Promise<ActionResponse<Program>> {
  if (!programId) {
    return { success: false, error: "Program ID is required." };
  }
  try {
    const doc = await firestore.collection('programs').doc(programId).get();
    if (!doc.exists) {
      return { success: false, error: "Program not found." };
    }
    const program = doc.data() as Program;
    program.id = doc.id;
    // CORRECTED: Removed the faulty logic that tried to access a `workouts` property that does not exist.
    // This was the primary cause of server crashes when loading program-related data.
    return { success: true, data: program };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch program details." };
  }
}

export async function getUserProgramAction(userId: string): Promise<ActionResponse<UserProgram>> {
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }
  try {
    const doc = await firestore.collection('userPrograms').doc(userId).get();
    if (!doc.exists) {
        const defaultProgram: UserProgram = { userId: userId, programId: '', startDate: '', completedWorkouts: [] };
        await firestore.collection('userPrograms').doc(userId).set(defaultProgram);
        return { success: true, data: defaultProgram };
    }
    return { success: true, data: doc.data() as UserProgram };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch user program data." };
  }
}

export async function upsertUserProgramAction(userProgramData: Partial<UserProgram>): Promise<ActionResponse<UserProgram>> {
    const { userId } = userProgramData;
    if(!userId) {
        return { success: false, error: "User ID is required." };
    }
    try {
        const docRef = firestore.collection('userPrograms').doc(userId);
        await docRef.set(userProgramData, { merge: true });
        const updatedDoc = await docRef.get();
        revalidatePath('/client/dashboard');
        return { success: true, data: updatedDoc.data() as UserProgram };
    } catch (error: any) {
        return { success: false, error: "Failed to update your program progress." };
    }
}

export async function getScheduledEventsAction(userId: string): Promise<ActionResponse<ScheduledEvent[]>> {
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }

    try {
        const snapshot = await firestore.collection('clientCalendar').where('userId', '==', userId).get();

        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const events: ScheduledEvent[] = snapshot.docs.map(doc => {
            const data = doc.data();
            const startTime = data.startTime || data.start; // Handle legacy data
            const endTime = data.endTime || data.end;       // Handle legacy data
            return {
                id: data.id,
                type: data.type,
                title: data.title,
                userId: data.userId,
                relatedId: data.relatedId,
                isCompleted: data.isCompleted,
                duration: data.duration,
                startTime: (startTime as Timestamp).toDate().toISOString(),
                endTime: (endTime as Timestamp).toDate().toISOString(),
            } as ScheduledEvent;
        });

        events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        return { success: true, data: events };
    } catch (error: any) {
        console.error("Error fetching scheduled events:", error);
        return { success: false, error: "Failed to fetch your scheduled events." };
    }
}

export async function updateWorkoutCompletionAction(details: { eventId: string; }): Promise<ActionResponse<{}>> {
    const { eventId } = details;
    if (!eventId) {
        return { success: false, error: "Event ID is required." };
    }
    try {
        await firestore.collection('clientCalendar').doc(eventId).update({ isCompleted: true });
        revalidatePath('/calendar');
        revalidatePath('/client/dashboard');
        return { success: true, data: {} };
    } catch (error: any) {
        console.error("Error updating workout completion:", error);
        return { success: false, error: "Failed to update workout completion status." };
    }
}

export async function deleteCalendarEventAction(eventId: string): Promise<ActionResponse<{}>> {
    if (!eventId) {
        return { success: false, error: "Event ID is required to delete." };
    }

    try {
        await firestore.collection('clientCalendar').doc(eventId).delete();
        revalidatePath('/calendar');
        revalidatePath('/client/dashboard');
        return { success: true, data: {} };
    } catch (error: any) {
        console.error("Error deleting calendar event:", error);
        return { success: false, error: "Failed to delete the calendar event." };
    }
}
