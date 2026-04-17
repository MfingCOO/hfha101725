'use server';

import { db as adminDb, auth } from '@/lib/firebaseAdmin';
import type { ClientProfile, CoachNote, CreateClientInput, UserTier, Chat } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateIdealBodyWeight, calculateNutritionalGoals } from '@/services/goals';

// FINAL FIX: Added the missing helper function.
const getParticipantId = (p: string | ClientProfile): string => typeof p === 'string' ? p : p.uid;

// FINAL FIX: This is the robust serialization function that handles all Timestamp formats recursively.
function serializeTimestamps(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(item => serializeTimestamps(item));
    }
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            newObj[key] = serializeTimestamps(data[key]);
        }
    }
    return newObj;
}

export async function unifiedSignupAction(
    data: CreateClientInput & { priceId?: string | null }
): Promise<{ success: boolean; error?: string; checkoutUrl?: string | null }> {

    let uid = '';
    try {
        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.fullName,
            emailVerified: false,
        });
        uid = userRecord.uid;

        await auth.setCustomUserClaims(uid, { role: 'client', tier: data.tier || 'free' });

        const idealBodyWeight = calculateIdealBodyWeight(data.height, data.units);
        
        const tempProfileForCalc: Partial<ClientProfile> = {
            onboarding: { ...data, birthdate: new Date(data.birthdate) },
            idealBodyWeight: idealBodyWeight, 
            height: { value: data.height, unit: data.units === 'imperial' ? 'in' : 'cm' },
        };

        const { idealGoals, actualGoals } = calculateNutritionalGoals(tempProfileForCalc as ClientProfile);

        const clientRef = adminDb.collection('clients').doc(uid);
        const clientPayload: any = {
            uid: uid,
            email: data.email,
            fullName: data.fullName,
            tier: data.tier || 'free',
            role: 'client',
            onboarding: data,
            createdAt: FieldValue.serverTimestamp(),
            height: { value: data.height, unit: data.units === 'imperial' ? 'in' : 'cm' },
            idealBodyWeight: idealBodyWeight,
            suggestedGoals: idealGoals, 
            customGoals: actualGoals,
            chatIds: [],
            challengeIds: [],
            hasLoggedInBefore: false,
        };

        if (data.coachId) {
            clientPayload.coachId = data.coachId;
        }

        await clientRef.set(clientPayload);

        return { success: true, checkoutUrl: null };

    } catch (error: any) {
        console.error("Error in unifiedSignupAction:", error);
        if (uid) {
            await auth.deleteUser(uid).catch(delError => console.error(`Failed to clean up auth user ${uid}`, delError));
        }
        return { success: false, error: error.message || 'An unknown error occurred during signup.' };
    }
}

export async function updateClientWthr(clientId: string, waist: number): Promise<{ success: boolean; error?: string }> {
    try {
        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) {
            throw new Error("Client not found.");
        }
        const clientData = clientSnap.data() as ClientProfile;
        const height = clientData.height;
        if (!height || typeof height.value !== 'number' || !height.unit) {
            return { success: false, error: "Client height is not set correctly." };
        }
        let wthr;
        if (height.unit === 'in') {
            wthr = waist / height.value;
        } else { // cm
            wthr = waist / (height.value * 0.393701);
        }
        await clientRef.update({ wthr: wthr });
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating WTHR for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function createClientByCoachAction(data: CreateClientInput): Promise<{ success: boolean; uid?: string; error?: any; }> {
    const batch = adminDb.batch();
    let uid = '';
    try {
        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.fullName,
            emailVerified: false,
        });
        uid = userRecord.uid;

        const idealBodyWeight = calculateIdealBodyWeight(data.height, data.units);

        const tempProfileForCalc: Partial<ClientProfile> = {
            onboarding: { ...data, birthdate: new Date(data.birthdate) },
            idealBodyWeight: idealBodyWeight, 
            height: { 
                value: data.height, 
                unit: data.units === 'imperial' ? 'in' : 'cm' 
            }
        };

        const { idealGoals, actualGoals } = calculateNutritionalGoals(tempProfileForCalc as ClientProfile);
        
        const clientRef = adminDb.collection('clients').doc(uid);
        const clientPayload: any = {
            uid: uid,
            email: data.email,
            fullName: data.fullName,
            tier: data.tier || 'free',
            role: 'client',
            onboarding: data,
            createdAt: FieldValue.serverTimestamp(),
            height: { value: data.height, unit: data.units },
            idealBodyWeight: idealBodyWeight,
            suggestedGoals: idealGoals, 
            customGoals: actualGoals,
            chatIds: [],
            challengeIds: [],
            hasLoggedInBefore: false,
        };

        if (data.coachId) {
            clientPayload.coachId = data.coachId;
        }

        batch.set(clientRef, clientPayload);
        await batch.commit();
        return { success: true, uid: uid };
    } catch (error: any) {
        console.error("Error in createClientByCoachAction:", error);
        if (uid) {
            await auth.deleteUser(uid).catch(delError => console.error(`Failed to clean up auth user ${uid}`, delError));
        }
        return { success: false, error: { message: error.message || 'An unknown error occurred' } };
    }
}

export async function deleteClientAction(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) throw new Error("Client ID is required for deletion.");
        const batch = adminDb.batch();
        const clientRef = adminDb.collection('clients').doc(clientId);
        batch.delete(clientRef);
        await auth.deleteUser(clientId);
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting client:", error);
        return { success: false, error: error.message };
    }
}

export async function getCoachNotesAction(clientId: string): Promise<{ success: boolean; data?: CoachNote[]; error?: string }> {
    try {
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`).orderBy('createdAt', 'desc');
        const snapshot = await notesRef.get();
        
        const notes = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: serializeTimestamps(data.createdAt),
            } as CoachNote;
        });

        return { success: true, data: notes };
    } catch (error: any) {
        console.error("Error fetching coach notes:", error);
        return { success: false, error: error.message };
    }
}

export async function addCoachNoteAction(clientId: string, text: string, coachId: string, coachName: string): Promise<{ success: boolean; error?: string, newNote?: CoachNote }> {
    try {
        if (!text.trim()) return { success: false, error: "Note cannot be empty." };
        
        const noteData = {
            text,
            coachId,
            coachName,
            createdAt: FieldValue.serverTimestamp(),
        };
        
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`);
        const newNoteRef = await notesRef.add(noteData);

        const newNote: CoachNote = {
            id: newNoteRef.id,
            text,
            coachId,
            coachName,
            clientId,
            createdAt: new Date().toISOString(),
        };

        return { success: true, newNote };
    } catch (error: any) {
        console.error("Error adding coach note:", error);
        return { success: false, error: error.message };
    }
}

export async function getClientByIdAction(clientId: string): Promise<{ success: boolean; data?: ClientProfile; error?: string }> {
    try {
        if (!clientId) throw new Error("Client ID is required.");
        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) return { success: false, error: "Client not found." };

        const clientData = { uid: clientSnap.id, ...clientSnap.data() };
        const serializableData = serializeTimestamps(clientData);

        return { success: true, data: serializableData as ClientProfile };
    } catch (error: any) {
        console.error(`Error fetching client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function getCoachingChatIdForClient(clientId: string): Promise<{ success: boolean; chatId?: string; error?: any; }> {
    try {
        const chatsRef = adminDb.collection('chats');
        const q = chatsRef.where('type', '==', 'coaching').where('participants', 'array-contains', clientId).limit(1);
        const snapshot = await q.get();
        if (snapshot.empty) {
            return { success: true, chatId: undefined };
        }
        const chatId = snapshot.docs[0].id;
        return { success: true, chatId };
    } catch (error: any) {
        console.error(`Error getting coaching chat ID for client ${clientId}:`, error);
        return { success: false, error: { message: error.message || 'An unknown error occurred' } };
    }
}

export async function getChatDetailsAction(chatId: string): Promise<{ success: boolean; data?: Chat; error?: string; }> {
    try {
        if (!chatId) throw new Error("Chat ID is required.");
        const chatRef = adminDb.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists) return { success: false, error: "Chat not found." };

        const chatData = chatSnap.data() as Chat;
        const participantUIDs = (chatData.participants || []).map(p => getParticipantId(p));
        
        const participantPromises = participantUIDs.map(uid => getClientByIdAction(uid));
        const participantResults = await Promise.all(participantPromises);

        const participantsWithProfiles = participantResults
            .filter(result => result.success && result.data)
            .map(result => result.data as ClientProfile);

        const finalChatData = {
            ...chatData,
            id: chatSnap.id,
            participants: participantsWithProfiles,
        };

        return { success: true, data: serializeTimestamps(finalChatData) as Chat };
    } catch (error: any) {
        console.error(`Error fetching chat details for ${chatId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function signupOrUpgradeClientAction(data: CreateClientInput & { password: string }) {
    const { email, password, ...clientData } = data;

    let uid = '';
    try {
        let isNewUser = false;

        try {
            const existingUser = await auth.getUserByEmail(email);
            uid = existingUser.uid;
            console.log(`[SIGNUP/UPGRADE] Existing user found → ${uid} (treating as upgrade)`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                const newUser = await auth.createUser({
                    email,
                    password,
                    displayName: clientData.fullName,
                    emailVerified: false,
                    disabled: false,
                });
                uid = newUser.uid;
                isNewUser = true;
                console.log(`[SIGNUP/UPGRADE] New user created as FREE + ACTIVE → ${uid}`);
            } else {
                throw error;
            }
        }

        if (isNewUser) {
            const idealBodyWeight = calculateIdealBodyWeight(clientData.height, clientData.units);

            const tempProfileForCalc: Partial<ClientProfile> = {
                onboarding: { ...clientData, birthdate: new Date(clientData.birthdate) },
                idealBodyWeight: idealBodyWeight,
                height: { value: clientData.height, unit: clientData.units === 'imperial' ? 'in' : 'cm' },
            };

            const { idealGoals, actualGoals } = calculateNutritionalGoals(tempProfileForCalc as ClientProfile);

            const clientRef = adminDb.collection('clients').doc(uid);
            const clientPayload: any = {
                uid: uid,
                email: email,
                fullName: clientData.fullName,
                tier: 'free' as const,
                status: 'active',
                role: 'client',
                onboarding: clientData,
                createdAt: FieldValue.serverTimestamp(),
                lastActivity: FieldValue.serverTimestamp(),
                height: { value: clientData.height, unit: clientData.units === 'imperial' ? 'in' : 'cm' },
                idealBodyWeight: idealBodyWeight,
                suggestedGoals: idealGoals,
                customGoals: actualGoals,
                chatIds: [],
                challengeIds: [],
                hasLoggedInBefore: false,
                isAnonymous: false,
                revenueCatLastEvent: null,
            };

            if (clientData.coachId) {
                clientPayload.coachId = clientData.coachId;
            }

            await clientRef.set(clientPayload);
            console.log(`[SIGNUP/UPGRADE] Full client document created (active + free) for ${uid}`);
        }

        return { success: true, uid };

    } catch (error: any) {
        console.error('[SIGNUP/UPGRADE] Error:', error);
        if (uid) {
            await auth.deleteUser(uid).catch(delError => console.error(`Failed to clean up auth user ${uid}`, delError));
        }
        return { success: false, error: error.message || 'Failed to create/upgrade account' };
    }
}
