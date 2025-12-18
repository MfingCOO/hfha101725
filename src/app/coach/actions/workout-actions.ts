'use server';

import { z } from 'zod';
import { db as firestore } from '@/lib/firebaseAdmin'; // Corrected import: db is renamed to firestore
import { Exercise, Workout, WorkoutBlock } from '@/types/workout-program';

// --- Discriminated Union for Action Responses ---
type ActionResponse<T = object> =
  | { success: true; data: T }
  | { success: false; error: string };

// --- Validation Schemas ---

const exerciseDataSchema = z.object({
    name: z.string().min(1, "Exercise name is required."),
    description: z.string().min(1, "Description is required."),
    bodyParts: z.array(z.string()).min(1, "At least one body part is required."),
    equipmentNeeded: z.string().min(1, "Equipment is required."),
    trackingMetrics: z.array(z.enum(['reps', 'weight', 'time', 'distance'])).min(1, "At least one metric is required."),
    mediaUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

const workoutDataSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    blocks: z.array(z.any()).min(1, "A workout must have at least one block."),
});


// --- Exercise Actions ---

export async function createExerciseAction(params: { coachId: string, exerciseData: any }): Promise<ActionResponse<Exercise>> {
    const validation = exerciseDataSchema.safeParse(params.exerciseData);
    if (!validation.success) {
        const errorMsg = validation.error.errors.map(e => e.message).join(', ');
        console.error("Validation failed:", errorMsg);
        return { success: false, error: errorMsg };
    }

    const { name, description, bodyParts, equipmentNeeded, trackingMetrics, mediaUrl } = validation.data;

    try {
        const docRef = firestore.collection('exercises').doc();
        const newExercise: Exercise = {
            id: docRef.id,
            coachId: params.coachId,
            name,
            description,
            bodyParts,
            equipmentNeeded,
            trackingMetrics,
            mediaUrl: mediaUrl || '',
        };
        await docRef.set(newExercise);
        return { success: true, data: newExercise };
    } catch (error: any) {
        console.error("Error creating exercise in Firestore:", error);
        return { success: false, error: "Failed to create exercise in the database." };
    }
}

export async function getExercisesForCoach(coachId: string): Promise<ActionResponse<Exercise[]>> {
    try {
        const snapshot = await firestore.collection('exercises').where('coachId', '==', coachId).get();
        const exercises = snapshot.docs.map(doc => doc.data() as Exercise);
        return { success: true, data: exercises };
    } catch (error: any) {
        console.error("Error fetching exercises:", error);
        return { success: false, error: "An unexpected error occurred while fetching exercises." };
    }
}

export async function updateExerciseAction(params: { exerciseId: string, exerciseData: any }): Promise<ActionResponse> {
    const validation = exerciseDataSchema.safeParse(params.exerciseData);
    if (!validation.success) {
        const errorMsg = validation.error.errors.map(e => e.message).join(', ');
        console.error("Validation failed:", errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        const docRef = firestore.collection('exercises').doc(params.exerciseId);
        await docRef.update(validation.data);
        return { success: true, data: {} };
    } catch (error: any) {
        console.error("Error updating exercise:", error);
        return { success: false, error: "Failed to update exercise in the database." };
    }
}

export async function deleteExerciseAction(exerciseId: string): Promise<ActionResponse> {
    try {
        await firestore.collection('exercises').doc(exerciseId).delete();
        return { success: true, data: {} };
    } catch (error: any) {
        console.error("Error deleting exercise:", error);
        return { success: false, error: "Failed to delete exercise." };
    }
}
