
'use server';

import { admin, db as adminDb, auth } from "@/lib/firebaseAdmin";
import { Chat, Challenge, ClientProfile } from "@/types";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

// Helper function to serialize Firestore Timestamps
function serializeTimestamps(obj: any): any {
    if (!obj) return obj;
    if (obj instanceof Timestamp) return obj.toDate().toISOString();
    if (Array.isArray(obj)) return obj.map(item => serializeTimestamps(item));
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = serializeTimestamps(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}


/**
 * Creates a new coaching chat between a coach and a client.
 * Updates both the client and coach profiles to include the new chat ID.
 */
export async function createCoachingChat(clientUid: string, coachUid: string, clientName: string, coachName: string): Promise<{ success: boolean; error?: string; chatId?: string }> {
    if (!clientUid || !coachUid) {
        return { success: false, error: "Client UID and Coach UID are required." };
    }

    const newChatRef = adminDb.collection('chats').doc();
    const clientRef = adminDb.collection('clients').doc(clientUid);
    const coachRef = adminDb.collection('clients').doc(coachUid);

    const chatData: Omit<Chat, 'id'> = {
        name: `Coaching: ${clientName}`,
        description: `Private chat between ${clientName} and ${coachName}`,
        type: 'coaching',
        ownerId: coachUid,
        participants: [clientUid, coachUid],
        participantCount: 2,
        createdAt: FieldValue.serverTimestamp(),
        lastMessage: undefined, // No last message on creation
        unreadCount: 0,
    };

    try {
        await adminDb.runTransaction(async (transaction) => {
            // 1. Set the new chat data
            transaction.set(newChatRef, chatData);

            // 2. Add chat ID to both client's and coach's profiles
            transaction.update(clientRef, { chatIds: FieldValue.arrayUnion(newChatRef.id) });
            transaction.update(coachRef, { chatIds: FieldValue.arrayUnion(newChatRef.id) });
        });

        return { success: true, chatId: newChatRef.id };

    } catch (error: any) {
        console.error("Error creating coaching chat:", error);
        return { success: false, error: error.message || "An unknown error occurred." };
    }
}


/**
 * Creates a new open chat available for all premium users to join.
 */
export async function createOpenChat(name: string, description: string, rules: string[], coachId: string): Promise<{ success: boolean; error?: string; chatId?: string }> {
    if (!name || !description) {
        return { success: false, error: "Chat name and description are required." };
    }

    const newChatRef = adminDb.collection('chats').doc();
    
    const chatData = {
        name,
        description,
        type: 'open',
        ownerId: coachId, 
        participants: [coachId], 
        participantCount: 1, 
        createdAt: FieldValue.serverTimestamp(),
        rules: rules || ['Be respectful and supportive.'],
    };

    try {
        await newChatRef.set(chatData);
        
        // The coach who creates it should also have it in their chat list
        const coachRef = adminDb.collection('clients').doc(coachId);
        await coachRef.update({ chatIds: FieldValue.arrayUnion(newChatRef.id) });

        revalidatePath('/chats'); // Revalidate for all users to see the new open chat

        return { success: true, chatId: newChatRef.id };
    } catch (error: any) {
        console.error("Error creating open chat:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all challenges, including participant data.
 * This is a coach-specific action.
 * BUG FIX: Now serializes timestamps before returning data.
 */
export async function getChallengesForCoach(): Promise<{ success: boolean; data?: Challenge[]; error?: any; }> {
    try {
        const q = adminDb.collection("challenges").orderBy("dates.from", "desc");
        const querySnapshot = await q.get();
        const challenges = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
        
        const serializedChallenges = serializeTimestamps(challenges);

        return { success: true, data: serializedChallenges };
    } catch (error) {
        console.error("Error fetching challenges for coach:", error);
        return { success: false, error };
    }
}

/**
 * Creates a new challenge and an associated chat room.
 * Only accessible to coaches.
 */
export async function createChallengeAction(challengeData: Omit<Challenge, 'id' | 'participantCount' | 'participants'>, coachId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!coachId) {
            return { success: false, error: "Authentication failed. Only coaches can create challenges." };
        }

        const challengeRef = adminDb.collection('challenges').doc();
        const chatRef = adminDb.collection('chats').doc(challengeRef.id); // Chat will have the same ID as the challenge
        const coachProfileRef = adminDb.collection('clients').doc(coachId);

        const batch = adminDb.batch();

        // 1. Create the Challenge document
        const newChallenge: Omit<Challenge, 'id'> = {
            ...challengeData,
            participants: [coachId], // The coach is the first participant
            participantCount: 1,
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(challengeRef, newChallenge);

        // 2. Create the associated Chat document
        const newChat: Omit<Chat, 'id'> = {
            name: challengeData.name,
            description: challengeData.description,
            type: 'challenge',
            ownerId: coachId,
            participants: [coachId],
            participantCount: 1,
            createdAt: FieldValue.serverTimestamp(),
            thumbnailUrl: challengeData.thumbnailUrl,
            rules: ['Be respectful, supportive, and stick to the challenge goals!']
        };
        batch.set(chatRef, newChat);

        // 3. Add the challenge and chat IDs to the coach's profile
        batch.update(coachProfileRef, {
            challengeIds: FieldValue.arrayUnion(challengeRef.id),
            chatIds: FieldValue.arrayUnion(chatRef.id),
        });

        await batch.commit();
        revalidatePath('/challenges'); // Revalidate the page for all users

        return { success: true };

    } catch (error: any) {
        console.error('Error creating new challenge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all clients for a specific coach.
 * BUG FIX: Now serializes timestamps before returning data.
 */
export async function getClientsForCoach(coachId: string): Promise<{ success: boolean; data?: ClientProfile[]; error?: any; }> {
    try {
        const q = adminDb.collection('clients').where('coachId', '==', coachId);
        const querySnapshot = await q.get();
        const clients = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));
        
        const serializedClients = serializeTimestamps(clients);

        return { success: true, data: serializedClients };
    } catch (error) {
        console.error("Error fetching clients:", error);
        return { success: false, error };
    }
}

export async function uploadImageAction(formData: FormData): Promise<{ success: boolean; error?: string; url?: string }> {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: 'No file provided.' };
        }

        const bucket = admin.storage().bucket();
        const filePath = `user-uploads/${Date.now()}-${file.name}`;
        const bucketFile = bucket.file(filePath);

        const fileBuffer = Buffer.from(await file.arrayBuffer());

        await bucketFile.save(fileBuffer, {
            metadata: {
                contentType: file.type,
            },
        });
        
        const [url] = await bucketFile.getSignedUrl({ action: 'read', expires: '03-09-2491' });

        return { success: true, url };

    } catch (error: any) {
        console.error("Error uploading image:", error);
        return { success: false, error: error.message };
    }
}


export async function upsertChallengeAction(challengeData: Omit<Challenge, 'id' | 'participantCount' | 'participants'>, coachId: string): Promise<{ success: boolean; error?: string }> {
    return createChallengeAction(challengeData, coachId);
}

export async function deleteChallengeAction(challengeId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const challengeRef = adminDb.collection('challenges').doc(challengeId);
        const chatRef = adminDb.collection('chats').doc(challengeId);

        // You might want to remove the challenge/chat from user profiles as well, which requires a more complex transaction or batch write.

        const batch = adminDb.batch();
        batch.delete(challengeRef);
        batch.delete(chatRef);
        await batch.commit();

        revalidatePath('/challenges');
        revalidatePath('/chats');

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting challenge:", error);
        return { success: false, error: error.message };
    }
}
