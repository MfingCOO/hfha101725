'use server';

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { postMessageAction } from '@/app/chats/actions';

// Helper function to verify if the user is a coach by checking their role in the 'clients' collection
async function verifyCoach(coachId: string): Promise<{ authorized: boolean; name: string }> {
    if (!adminDb || !coachId) {
        return { authorized: false, name: 'Unknown' };
    }
    try {
        const coachSnap = await adminDb.collection('clients').doc(coachId).get();
        if (coachSnap.exists && coachSnap.data()?.role === 'coach') {
            return { authorized: true, name: coachSnap.data()?.fullName || 'Your Coach' };
        }
        return { authorized: false, name: 'Unknown' };
    } catch (error) {
        console.error(`Error verifying coach ${coachId}:`, error);
        return { authorized: false, name: 'Unknown' };
    }
}

const BroadcastMiaMessageInputSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
  coachId: z.string(),
  chatIds: z.array(z.string()),
});

export async function broadcastMiaMessageAction(input: z.infer<typeof BroadcastMiaMessageInputSchema>) {
  if (!adminDb) {
    return { success: false, error: { message: 'Server configuration error.' } };
  }

  try {
    const { message, coachId, chatIds } = BroadcastMiaMessageInputSchema.parse(input);

    const { authorized, name: coachName } = await verifyCoach(coachId);
    if (!authorized) {
        return { success: false, error: { message: 'Unauthorized action.' } };
    }

    if (chatIds.length === 0) {
        return { success: true, count: 0, message: 'No clients to message.' };
    }

    const broadcastPromises = chatIds.map(chatId => {
        return postMessageAction({
            chatId: chatId,
            text: message,
            userId: coachId,
            userName: coachName,
        });
    });

    await Promise.all(broadcastPromises);

    return { success: true, count: chatIds.length };

  } catch (error: any) {
    console.error('Failed to broadcast MIA message:', error);
    return { success: false, error: { message: error.message || 'An unknown error occurred.' } };
  }
}
