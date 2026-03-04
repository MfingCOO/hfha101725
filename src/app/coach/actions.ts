'use server';

import { admin, db as adminDb } from "@/lib/firebaseAdmin";
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
 * Updates a coach's email address in Firebase Auth.
 */
export async function updateCoachEmailAction(uid: string, newEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
        await admin.auth().updateUser(uid, {
            email: newEmail,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating coach email:", error);
        return { success: false, error: error.message || "Failed to update email." };
    }
}

/**
 * Updates a coach's password in Firebase Auth.
 */
export async function updateCoachPasswordAction(uid: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        await admin.auth().updateUser(uid, {
            password: newPassword,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating coach password:", error);
        return { success: false, error: error.message || "Failed to update password." };
    }
}

/**
 * Creates a new coaching chat between a coach and a client.
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
        unreadCount: 0,
    };

    try {
        await adminDb.runTransaction(async (transaction) => {
            transaction.set(newChatRef, chatData);
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
    
    const chatData: Omit<Chat, 'id'> = {
        name,
        description,
        type: 'open',
        ownerId: coachId, 
        participants: [coachId], 
        participantCount: 1, 
        createdAt: FieldValue.serverTimestamp(),
        rules: rules || ['Be respectful and supportive.'],
        unreadCount: 0
    };

    try {
        await newChatRef.set(chatData);
        const coachRef = adminDb.collection('clients').doc(coachId);
        await coachRef.update({ chatIds: FieldValue.arrayUnion(newChatRef.id) });

        revalidatePath('/chats');
        return { success: true, chatId: newChatRef.id };
    } catch (error: any) {
        console.error("Error creating open chat:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all challenges for coach.
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
 */
export async function createChallengeAction(challengeData: Omit<Challenge, 'id' | 'participantCount' | 'participants'>, coachId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!coachId) {
            return { success: false, error: "Authentication failed. Only coaches can create challenges." };
        }

        const challengeRef = adminDb.collection('challenges').doc();
        const chatRef = adminDb.collection('chats').doc(challengeRef.id);
        const coachProfileRef = adminDb.collection('clients').doc(coachId);

        const batch = adminDb.batch();

        const newChallenge: Omit<Challenge, 'id'> = {
            ...challengeData,
            participants: [coachId],
            participantCount: 1,
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(challengeRef, newChallenge);

        const newChat: Omit<Chat, 'id'> = {
            name: challengeData.name ?? (challengeData as any).title ?? "New Challenge",
            description: challengeData.description,
            type: 'challenge',
            ownerId: coachId,
            participants: [coachId],
            participantCount: 1,
            createdAt: FieldValue.serverTimestamp(),
            unreadCount: 0,
            rules: ['Be respectful, supportive, and stick to the challenge goals!']
        };
        batch.set(chatRef, newChat);

        batch.update(coachProfileRef, {
            challengeIds: FieldValue.arrayUnion(challengeRef.id),
            chatIds: FieldValue.arrayUnion(chatRef.id),
        });

        await batch.commit();
        revalidatePath('/challenges');

        return { success: true };

    } catch (error: any) {
        console.error('Error creating new challenge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all clients for a specific coach.
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
            metadata: { contentType: file.type },
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