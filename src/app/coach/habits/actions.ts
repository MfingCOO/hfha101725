'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import type { CustomHabit } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

// Schema for validating habit creation/updates
const habitSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, 'Habit name must be at least 3 characters.'),
    description: z.string().min(5, 'Description must be at least 5 characters.'),
    coachId: z.string().optional(),
});

/**
 * Fetches all custom habits from the library.
 */
export async function getCustomHabitsAction(): Promise<{ success: boolean; data?: CustomHabit[]; error?: string }> {
    try {
        const snapshot = await adminDb.collection('customHabits').orderBy('name', 'asc').get();
        
        const habits = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                frequency: data.frequency || 'daily',
                coachId: data.coachId || 'system',
                createdAt: data.createdAt ? (data.createdAt.toDate?.() || data.createdAt) : new Date().toISOString(),
            } as CustomHabit;
        });

        return { success: true, data: habits };
    } catch (error: any) {
        console.error('Error fetching custom habits:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Creates or updates a custom habit in the library.
 */
export async function saveCustomHabitAction(data: { id?: string; name: string; description: string; coachId?: string }): Promise<{ success: boolean; id?: string; error?: string }> {
    const validation = habitSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }
    
    try {
        const { id, name, description, coachId } = validation.data;
        
        const habitData = { 
            name, 
            description, 
            coachId: coachId || 'system',
            frequency: 'daily',
            updatedAt: FieldValue.serverTimestamp() 
        };
        
        let resultId = id;

        if (id) {
            // Update existing habit
            await adminDb.collection('customHabits').doc(id).set(habitData, { merge: true });
        } else {
            // Create new habit
            const newDocRef = await adminDb.collection('customHabits').add({
                ...habitData,
                createdAt: FieldValue.serverTimestamp(),
            });
            resultId = newDocRef.id;
        }

        revalidatePath('/coach/habits');
        return { success: true, id: resultId };
    } catch (error: any) {
        console.error('Error saving custom habit:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes a custom habit from the library.
 */
export async function deleteCustomHabitAction(habitId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!habitId) {
            throw new Error('Habit ID is required for deletion.');
        }
        await adminDb.collection('customHabits').doc(habitId).delete();
        
        revalidatePath('/coach/habits');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting custom habit:', error);
        return { success: false, error: error.message };
    }
}