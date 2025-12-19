'use server';

import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Program, UserProgram } from '@/types/workout-program';
import { ScheduledEvent } from '../../types/event'; // Corrected import path
import { ActionResponse } from '@/types/action-response';
import { v4 as uuidv4 } from 'uuid';


/**
 * Fetches all available workout programs from the database.
 */
export async function getClientProgramsAction(): Promise<ActionResponse<Program[]>> {
  try {
    const snapshot = await firestore.collection('programs').orderBy('name').get();
    if (snapshot.empty) {
      return { success: true, data: [] };
    }
    const programs = snapshot.docs.map(doc => doc.data() as Program);
    return { success: true, data: programs };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch workout programs." };
  }
}

/**
 * Fetches the full details of a single workout program.
 */
export async function getProgramDetailsAction(programId: string): Promise<ActionResponse<Program>> {
  if (!programId) {
    return { success: false, error: "Program ID is required." };
  }
  try {
    const doc = await firestore.collection('programs').doc(programId).get();
    if (!doc.exists) {
      return { success: false, error: "Program not found." };
    }
    return { success: true, data: doc.data() as Program };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch program details." };
  }
}

/**
 * Sets the active workout program for a specific client.
 */
export async function setClientProgramAction(clientId: string, programId: string | null): Promise<ActionResponse<{}>> {
  if (!clientId) {
    return { success: false, error: "Client ID is required." };
  }
  try {
    await firestore.collection('clients').doc(clientId).update({ activeProgramId: programId });
    revalidatePath('/client/dashboard');
    return { success: true, data: {} };
  } catch (error: any) {
    return { success: false, error: "Failed to update your workout program." };
  }
}

/**
 * Fetches the user-specific program data, like completed workouts.
 */
export async function getUserProgramAction(userId: string): Promise<ActionResponse<UserProgram>> {
  if (!userId) {
    return { success: false, error: "User ID is required." };
  }
  try {
    const doc = await firestore.collection('userPrograms').doc(userId).get();
    if (!doc.exists) {
      return { success: false, error: "No user program data found." };
    }
    return { success: true, data: doc.data() as UserProgram };
  } catch (error: any) {
    return { success: false, error: "Failed to fetch user program data." };
  }
}

/**
 * Creates or updates user-specific program data, like progress.
 */
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

/**
 * Schedules a workout for a user by creating a new event.
 */
export async function scheduleWorkoutAction(details: {
    userId: string;
    workoutId: string;
    workoutName: string;
    startTime: Date;
    duration: number;
}): Promise<ActionResponse<ScheduledEvent>> {
    const { userId, workoutId, workoutName, startTime, duration } = details;
    if (!userId || !workoutId || !startTime) {
        return { success: false, error: "User ID, Workout ID, and start time are required." };
    }

    try {
        const eventId = uuidv4();
        const endTime = new Date(startTime.getTime() + duration * 60000); // duration is in minutes

        const newEvent: ScheduledEvent = {
            id: eventId,
            type: 'workout',
            title: workoutName,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            userId,
            relatedId: workoutId,
            isCompleted: false
        };

        await firestore.collection('scheduledEvents').doc(eventId).set(newEvent);
        revalidatePath('/client/calendar');
        revalidatePath('/client/dashboard');

        return { success: true, data: newEvent };
    } catch (error: any) {
        console.error("Error scheduling workout:", error);
        return { success: false, error: "Failed to schedule the workout. Please try again." };
    }
}
