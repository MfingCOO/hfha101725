'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import type { Program, ProgramWeek } from '@/types/workout-program';
import type { ActionResponse } from '@/types/action-response';

const programDataSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  description: z.string().optional(),
  duration: z.union([z.literal('continuous'), z.number().positive()])
});

const weekDataSchema = z.object({
    id: z.string(),
    weekNumber: z.number(),
    name: z.string(),
    workoutId: z.string().min(1, "Workout ID is required"),
});

export async function upsertProgramAction(params: {
  programData: Omit<Program, 'id' | 'weeks'>;
  weeksData: ProgramWeek[];
  programId: string | null;
}): Promise<ActionResponse<Program>> {
  const { programData, weeksData, programId } = params;

  const validatedProgram = programDataSchema.safeParse(programData);
  if (!validatedProgram.success) {
    return { success: false, error: validatedProgram.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const docRef = programId 
      ? firestore.collection('programs').doc(programId) 
      : firestore.collection('programs').doc();

    const finalProgram: Program = {
      id: docRef.id,
      name: validatedProgram.data.name,
      description: validatedProgram.data.description || '',
      duration: validatedProgram.data.duration,
      weeks: weeksData,
    };

    await docRef.set(finalProgram, { merge: true });

    revalidatePath('/coach/library');
    return { success: true, data: finalProgram };

  } catch (error: any) {
    console.error("Error upserting program:", error);
    return { success: false, error: error.message || "An unknown error occurred." };
  }
}

export async function getProgramsAction(): Promise<ActionResponse<Program[]>> {
  try {
    const snapshot = await firestore.collection('programs').orderBy('name').get();
    const programs = snapshot.docs.map(doc => doc.data() as Program);
    return { success: true, data: programs };
  } catch (error: any) {
    console.error("Error fetching programs:", error);
    return { success: false, error: "Failed to fetch programs." };
  }
}

export async function deleteProgramAction(programId: string): Promise<ActionResponse<{}>> {
    try {
        await firestore.collection('programs').doc(programId).delete();
        revalidatePath('/coach/library');
        return { success: true, data: {} };
    } catch (error: any) {
        console.error("Error deleting program:", error);
        return { success: false, error: error.message };
    }
}
