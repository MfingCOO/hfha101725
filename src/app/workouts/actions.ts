'use server';

import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Workout, ExerciseBlock, Set } from '@/types/workout-program';
import { ActionResponse } from '@/types/action-response';
import { v4 as uuidv4 } from 'uuid';


// --- Data Migration Helper ---
// This function ensures that workouts fetched from Firestore match the latest data structure.
function migrateWorkoutSets(workout: any): Workout {
    const migratedBlocks = workout.blocks.map((block: any) => {
        if (block.type === 'exercise' && typeof block.sets === 'number') {
            // This is the old format. Convert it.
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
            // Return a new block with the corrected sets structure
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

// Action to create or update a workout
export async function upsertWorkoutAction(workoutData: Workout): Promise<ActionResponse<Workout>> {
    try {
        if (!workoutData.id) {
            workoutData.id = uuidv4();
        }
        await firestore.collection('workouts').doc(workoutData.id).set(workoutData);
        revalidatePath('/coach/workouts');
        return { success: true, data: workoutData };
    } catch (error: any) {
        return { success: false, error: 'Failed to save workout.' };
    }
}

// Action to delete a workout
export async function deleteWorkoutAction(workoutId: string): Promise<ActionResponse<{}>> {
    try {
        await firestore.collection('workouts').doc(workoutId).delete();
        revalidatePath('/coach/workouts');
        return { success: true, data: {} };
    } catch (error: any) {
        return { success: false, error: 'Failed to delete workout.' };
    }
}

// Action to get a single workout by its ID
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

// Action to get multiple workouts by their IDs
export async function getWorkoutsByIdsAction(workoutIds: string[]): Promise<ActionResponse<Workout[]>> {
    if (!workoutIds || workoutIds.length === 0) {
        return { success: true, data: [] };
    }

    try {
        const snapshot = await firestore.collection('workouts').where('id', 'in', workoutIds).get();
        const workouts = snapshot.docs.map(doc => doc.data() as Workout);
        
        // Create a map for quick lookups
        const workoutMap = new Map(workouts.map(w => [w.id, w]));

        // Ensure the order is the same as the input IDs and migrate data structure
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
