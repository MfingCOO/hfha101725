'use server';

import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Workout, ExerciseBlock, Set, PerformanceLog } from '@/types/workout-program';
import { ActionResponse } from '@/types/action-response';
import { v4 as uuidv4 } from 'uuid';


// --- Data Migration Helper ---
function migrateWorkoutSets(workout: any): Workout {
    const migratedBlocks = workout.blocks.map((block: any) => {
        if (block.type === 'exercise' && typeof block.sets === 'number') {
            const numberOfSets = block.sets;
            const newSets: Set[] = [];
            for (let i = 0; i < numberOfSets; i++) {
                newSets.push({
                    id: uuidv4(),
                    metric: 'reps',
                    value: block.reps?.toString() || '0',
                    weight: block.weight?.toString() || '0'
                });
            }
            return { ...block, sets: newSets };
        }
        if (block.type === 'group') {
            const migratedGroupBlocks = block.blocks.map((groupBlock: any) => {
                 if (typeof groupBlock.sets === 'number') {
                    const numberOfSets = groupBlock.sets;
                    const newSets: Set[] = [];
                    for (let i = 0; i < numberOfSets; i++) {
                        newSets.push({
                            id: uuidv4(),
                            metric: 'reps',
                            value: groupBlock.reps?.toString() || '0',
                            weight: groupBlock.weight?.toString() || '0'
                        });
                    }
                    return { ...groupBlock, sets: newSets };
                 }
                 return groupBlock;
            });
            return { ...block, blocks: migratedGroupBlocks };
        }
        return block;
    });

    return { ...workout, blocks: migratedBlocks };
}

// Action to create or update a workout - RESTORED AND FIXED
export async function upsertWorkoutAction(workoutData: Workout): Promise<ActionResponse<Workout>> {
    try {
        if (!workoutData.id) {
            workoutData.id = uuidv4();
        }

        if (workoutData.duration && typeof workoutData.duration !== 'number') {
            workoutData.duration = Number(workoutData.duration);
        }

        await firestore.collection('workouts').doc(workoutData.id).set(workoutData);
        revalidatePath('/coach/workouts');
        return { success: true, data: workoutData };
    } catch (error: any) {
        return { success: false, error: 'Failed to save workout.' };
    }
}

// Action to delete a workout - RESTORED
export async function deleteWorkoutAction(workoutId: string): Promise<ActionResponse<{}>> {
    try {
        await firestore.collection('workouts').doc(workoutId).delete();
        revalidatePath('/coach/workouts');
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: 'Failed to delete workout.' };
    }
}

export async function listWorkoutsAction(): Promise<ActionResponse<Workout[]>> {
    try {
        const snapshot = await firestore.collection('workouts').get();
        const workouts = snapshot.docs.map(doc => doc.data() as Workout);
        return { success: true, data: workouts };
    } catch (error) {
        return { success: false, error: "Failed to list workouts." };
    }
}

// Action to get a single workout by its ID - RESTORED
export async function getWorkoutByIdAction(workoutId: string): Promise<ActionResponse<Workout>> {
    try {
        const doc = await firestore.collection('workouts').doc(workoutId).get();
        if (!doc.exists) {
            return { success: false, error: 'Workout not found.' };
        }
        const workout = doc.data() as Workout;
        const migratedWorkout = migrateWorkoutSets(workout);
        return { success: true, data: migratedWorkout };
    } catch (error: any) {
        return { success: false, error: 'Failed to fetch workout.' };
    }
}

// Action to get multiple workouts by their IDs - RESTORED
export async function getWorkoutsByIdsAction(workoutIds: string[]): Promise<ActionResponse<Workout[]>> {
    if (!workoutIds || workoutIds.length === 0) {
        return { success: true, data: [] };
    }

    try {
        const snapshot = await firestore.collection('workouts').where('id', 'in', workoutIds).get();
        const workouts = snapshot.docs.map(doc => doc.data() as Workout);
        
        const workoutMap = new Map(workouts.map(w => [w.id, w]));

        const orderedAndMigratedWorkouts = workoutIds.map(id => {
            const workout = workoutMap.get(id);
            return workout ? migrateWorkoutSets(workout) : null;
        }).filter((w): w is Workout => w !== null);

        return { success: true, data: orderedAndMigratedWorkouts };
    } catch (error: any) {
        console.error("Error fetching workouts by IDs:", error);
        return { success: false, error: 'Failed to fetch workouts.' };
    }
}

export async function logWorkoutPerformanceAction(logData: PerformanceLog): Promise<ActionResponse<PerformanceLog>> {
    try {
        const logId = uuidv4();
        const logWithId = { ...logData, id: logId, completedAt: new Date() };
        await firestore.collection('workout_logs').doc(logId).set(logWithId);
        return { success: true, data: logWithId };
    } catch (error: any) {
        console.error("Error logging workout performance:", error);
        return { success: false, error: "Failed to log workout performance." };
    }
}

export async function getWorkoutHistoryAction(userId: string, workoutId: string): Promise<ActionResponse<PerformanceLog[]>> {
    try {
        const snapshot = await firestore.collection('workout_logs')
            .where('userId', '==', userId)
            .where('workoutId', '==', workoutId)
            .orderBy('completedAt', 'desc')
            .get();
            
        const logs = snapshot.docs.map(doc => doc.data() as PerformanceLog);
        return { success: true, data: logs };
    } catch (error: any) {
        console.error("Error fetching workout history:", error);
        return { success: false, error: "Failed to fetch workout history." };
    }
}

export async function getFullWorkoutHistoryAction(userId: string): Promise<ActionResponse<PerformanceLog[]>> {
    try {
        // Query without ordering to avoid needing a composite index for (userId, completedAt)
        const snapshot = await firestore.collection('workout_logs')
            .where('userId', '==', userId)
            .get();

        // The 'completedAt' field from Firestore is a Timestamp object.
        // We need to convert it to a JS Date object for sorting and for client-side compatibility.
        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            const completedAt = data.completedAt.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
            return {
                ...data,
                completedAt,
            } as PerformanceLog;
        });

        // Now, sort the logs in memory on the server in descending order (newest first).
        logs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

        return { success: true, data: logs };
    } catch (error: any) {
        console.error("Error fetching full workout history:", error);
        return { success: false, error: "Failed to fetch full workout history." };
    }
}
