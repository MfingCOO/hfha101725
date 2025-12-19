'use server';

import { z } from 'zod';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Exercise, Workout } from '@/types/workout-program';

export type ActionResponse<T = object> =
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
    description: z.string().optional(),
    blocks: z.array(z.any()).min(1, "A workout must have at least one block."),
});


// --- Exercise Actions (Shared) ---

export async function createExerciseAction(params: { exerciseData: any }): Promise<ActionResponse<Exercise>> {
    const validation = exerciseDataSchema.safeParse(params.exerciseData);
    if (!validation.success) {
        const errorMsg = validation.error.errors.map(e => e.message).join(', ');
        return { success: false, error: errorMsg };
    }

    try {
        const docRef = firestore.collection('exercises').doc();
        const newExercise: Exercise = {
            id: docRef.id,
            name: validation.data.name,
            description: validation.data.description,
            bodyParts: validation.data.bodyParts,
            equipmentNeeded: validation.data.equipmentNeeded,
            trackingMetrics: validation.data.trackingMetrics,
            mediaUrl: validation.data.mediaUrl || '',
        };
        await docRef.set(newExercise);
        return { success: true, data: newExercise };
    } catch (error: any) {
        return { success: false, error: "Failed to create exercise." };
    }
}

export async function getExercisesAction(): Promise<ActionResponse<Exercise[]>> {
    try {
        const snapshot = await firestore.collection('exercises').orderBy('name').get();
        const exercises = snapshot.docs.map(doc => doc.data() as Exercise);
        return { success: true, data: exercises };
    } catch (error: any) {
        return { success: false, error: "Failed to fetch exercises." };
    }
}

export async function updateExerciseAction(params: { exerciseId: string, exerciseData: any }): Promise<ActionResponse> {
    const validation = exerciseDataSchema.safeParse(params.exerciseData);
    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    try {
        await firestore.collection('exercises').doc(params.exerciseId).update(validation.data);
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: "Failed to update exercise." };
    }
}

export async function deleteExerciseAction(exerciseId: string): Promise<ActionResponse> {
    try {
        await firestore.collection('exercises').doc(exerciseId).delete();
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: "Failed to delete exercise." };
    }
}

// --- Workout Actions (Shared) ---

export async function createWorkoutAction(params: { workoutData: any }): Promise<ActionResponse<Workout>> {
    const validation = workoutDataSchema.safeParse(params.workoutData);
    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    try {
        const docRef = firestore.collection('workouts').doc();
        const newWorkout: Workout = {
            id: docRef.id,
            name: validation.data.name,
            description: validation.data.description || '',
            blocks: validation.data.blocks,
        };
        await docRef.set(newWorkout);
        return { success: true, data: newWorkout };
    } catch (error: any) {
        return { success: false, error: "Failed to create workout." };
    }
}

export async function getWorkoutsAction(): Promise<ActionResponse<Workout[]>> {
    try {
        const snapshot = await firestore.collection('workouts').orderBy('name').get();
        const workouts = snapshot.docs.map(doc => doc.data() as Workout);
        return { success: true, data: workouts };
    } catch (error: any) {
        return { success: false, error: "Failed to fetch workouts." };
    }
}

export async function updateWorkoutAction(params: { workoutId: string, workoutData: any }): Promise<ActionResponse> {
    const validation = workoutDataSchema.safeParse(params.workoutData);
    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }
    try {
        await firestore.collection('workouts').doc(params.workoutId).update(validation.data);
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: "Failed to update workout." };
    }
}

export async function deleteWorkoutAction(workoutId: string): Promise<ActionResponse> {
    try {
        await firestore.collection('workouts').doc(workoutId).delete();
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: "Failed to delete workout." };
    }
}
