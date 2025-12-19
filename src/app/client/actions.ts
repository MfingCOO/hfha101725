'use server';

import { revalidatePath } from 'next/cache';
import { db as firestore } from '@/lib/firebaseAdmin';
import { Program } from '@/types/workout-program';
import { ActionResponse } from '@/types/action-response';

/**
 * Fetches all available workout programs from the database.
 * This is intended to be used by clients to browse programs.
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
    console.error("Error fetching programs for client:", error);
    return { success: false, error: "Failed to fetch workout programs." };
  }
}

/**
 * Sets or unsets the active workout program for a specific client.
 * @param clientId - The ID of the client to update.
 * @param programId - The ID of the program to set as active, or null to unsubscribe.
 */
export async function setClientProgramAction(clientId: string, programId: string | null): Promise<ActionResponse<{}>> {
  if (!clientId) {
    return { success: false, error: "Client ID is required." };
  }

  try {
    const clientRef = firestore.collection('clients').doc(clientId);
    await clientRef.update({
      activeProgramId: programId // Set the ID or null to clear it
    });

    // Revalidate the client's dashboard to reflect the change immediately.
    revalidatePath('/client/dashboard');

    return { success: true, data: {} };
  } catch (error: any) {
    console.error(`Error updating client program for ${clientId}:`, error);
    return { success: false, error: "Failed to update your workout program." };
  }
}
