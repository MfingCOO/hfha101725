'use server';

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { COACH_UIDS } from '@/lib/coaches';
import { postMessageAction } from '@/app/chats/actions';

// Minimal profile type for this server action
interface Profile {
    fullName?: string;
}

// Helper function to get a profile from the 'clients' or 'userProfiles' collection.
export async function getClientProfile_Admin(uid: string): Promise<Profile | null> {
    try {
        const clientDoc = await adminDb.collection('clients').doc(uid).get();
        if (clientDoc.exists) {
            return clientDoc.data() as Profile;
        }
        
        const userDoc = await adminDb.collection('userProfiles').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data() as Profile;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching profile for ${uid}:`, error);
        return null;
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

    if (!COACH_UIDS.includes(coachId)) {
        return { success: false, error: { message: 'Unauthorized action.' } };
    }

    if (chatIds.length === 0) {
        return { success: true, count: 0, message: 'No clients to message.' };
    }

    const coachProfile = await getClientProfile_Admin(coachId);
    const coachName = coachProfile?.fullName || 'Your Coach';

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
