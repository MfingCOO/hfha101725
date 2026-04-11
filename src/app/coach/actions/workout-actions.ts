'use server';

import { z } from 'zod';
import { db as firestore, db as adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { Exercise, Workout } from '@/types/workout-program';
import { FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { storage as adminStorage } from 'firebase-admin';

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
    duration: z.number().optional(),
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
            duration: validation.data.duration || 0,
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
        const dataToUpdate = {
            ...validation.data,
            duration: validation.data.duration || 0,
        };
        await firestore.collection('workouts').doc(params.workoutId).update(dataToUpdate);
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

export async function duplicateWorkoutAction(workoutId: string): Promise<ActionResponse<Workout>> {
    try {
        const workoutRef = firestore.collection('workouts').doc(workoutId);
        const workoutSnap = await workoutRef.get();

        if (!workoutSnap.exists) {
            return { success: false, error: "Workout not found." };
        }

        const originalWorkout = workoutSnap.data() as Workout;

        const newWorkoutRef = firestore.collection('workouts').doc();
        const newWorkout: Workout = {
            ...originalWorkout,
            id: newWorkoutRef.id,
            name: `${originalWorkout.name} (Copy)`,
        };

        await newWorkoutRef.set(newWorkout);

        return { success: true, data: newWorkout };
    } catch (error: any) {
        return { success: false, error: "Failed to duplicate workout." };
    }
}

// --- Pre-recorded Workout Actions ---

const PreRecordedWorkoutSchema = z.object({
    title: z.string().min(1, "Title is required."),
    youtubeUrl: z.string().url("Must be a valid YouTube URL."),
    thumbnailUrl: z.string().url("Must be a valid thumbnail URL."),
    coachId: z.string(),
});

export async function addPreRecordedWorkoutAction(input: z.infer<typeof PreRecordedWorkoutSchema>) {
    if (!adminDb) {
      return { success: false, error: "Server configuration error." };
    }
  
    try {
      const workoutData = PreRecordedWorkoutSchema.parse(input);
  
      const docRef = adminDb.collection('preRecordedWorkouts').doc();
      await docRef.set({
        ...workoutData,
        createdAt: FieldValue.serverTimestamp(),
      });
  
      return { success: true, docId: docRef.id };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors.map(e => e.message).join(', ') };
      }
      console.error("Error adding pre-recorded workout:", error);
      return { success: false, error: error.message || "An unknown error occurred." };
    }
}
  
export async function getPreRecordedWorkoutsAction() {
    if (!adminDb) {
        return { success: false, error: "Server configuration error.", data: [] };
    }

    try {
        const snapshot = await adminDb.collection('preRecordedWorkouts').orderBy('createdAt', 'desc').get();
        
        const workouts = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                youtubeUrl: data.youtubeUrl,
                thumbnailUrl: data.thumbnailUrl,
                createdAt: data.createdAt.toDate().toISOString(),
            };
        });

        return { success: true, data: workouts };
    } catch (error: any) {
        console.error("Error fetching pre-recorded workouts:", error);
        return { success: false, error: error.message || "An unknown error occurred.", data: [] };
    }
}

const ThumbnailUploadSchema = z.object({
    fileDataUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),           // ← NEW: we now pass this from the client (just like chat)
});

export async function uploadPreRecordedThumbnailAction(input: z.infer<typeof ThumbnailUploadSchema>): Promise<ActionResponse<{ fileUrl: string }>> {
    try {
        const { fileDataUrl, fileName } = ThumbnailUploadSchema.parse(input);
        
        const base64Content = fileDataUrl.split(';base64,').pop();
        if (!base64Content) {
            return { success: false, error: "Invalid file data URL format." };
        }
        const buffer = Buffer.from(base64Content, 'base64');
        const fileType = fileDataUrl.substring(fileDataUrl.indexOf(':') + 1, fileDataUrl.indexOf(';'));

        // ← ONLY THESE 3 LINES ARE NEW (uses your existing FIREBASE_SERVICE_ACCOUNT_KEY)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
        const bucketName = `${serviceAccount.project_id}.appspot.com`;
        const bucket = adminStorage().bucket('hunger-free-and-happy-app.firebasestorage.app');
        // ↑ end of change

        const fileId = uuidv4();
        const fullFileName = `${fileId}-${fileName}`;
        const filePath = `preRecordedThumbnails/${fullFileName}`;
        const file = bucket.file(filePath);
        
        const downloadToken = uuidv4();

        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

        return { success: true, data: { fileUrl: publicUrl } };
    } catch (error: any) {
        console.error("Error uploading thumbnail:", error);
        return { success: false, error: error.message || 'Failed to upload image.' };
    }
}
export async function deletePreRecordedWorkoutAction(workoutId: string) {
    if (!adminDb) {
      return { success: false, error: "Server configuration error." };
    }
  
    try {
      await adminDb.collection('preRecordedWorkouts').doc(workoutId).delete();
      return { success: true };
    } catch (error: any) {
      console.error("Error deleting pre-recorded workout:", error);
      return { success: false, error: error.message || "Failed to delete workout" };
    }
  }