'use server';

import { db as firestore } from '@/lib/firebaseAdmin';
import { Exercise } from '@/types/workout-program';
import { ActionResponse } from '@/types/action-response';

/**
 * Fetches multiple exercise documents from the database by their IDs.
 * @param exerciseIds - An array of exercise IDs to fetch.
 */
export async function getExercisesByIdsAction(exerciseIds: string[]): Promise<ActionResponse<Exercise[]>> {
  if (!exerciseIds || exerciseIds.length === 0) {
    return { success: true, data: [] };
  }
  if (exerciseIds.length > 30) {
    return { success: false, error: "Cannot fetch more than 30 exercises at a time." };
  }

  try {
    const snapshot = await firestore.collection('exercises').where('id', 'in', exerciseIds).get();
    if (snapshot.empty) {
      return { success: true, data: [] };
    }
    const exercises = snapshot.docs.map(doc => doc.data() as Exercise);
    return { success: true, data: exercises };
  } catch (error: any) {
    console.error("Error fetching exercises by IDs:", error);
    return { success: false, error: "Failed to fetch exercise details." };
  }
}
