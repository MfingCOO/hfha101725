'use server';

import { db as adminDb, auth } from '@/lib/firebaseAdmin';
import type { ClientProfile, CoachNote, CreateClientInput, UserTier, Chat } from '@/types';
import Stripe from 'stripe';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateIdealBodyWeight, calculateNutritionalGoals } from '@/services/goals';

// CORRECTED: Uses the correct environment variable name and does not hardcode the key.
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});

// This is a new, more robust serialization function
function serializeTimestamps(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }

    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }

    if (typeof data.seconds === 'number' && typeof data.nanoseconds === 'number') {
        return new Date(data.seconds * 1000 + data.nanoseconds / 1000000).toISOString();
    }
    if (typeof data._seconds === 'number' && typeof data._nanoseconds === 'number') {
        return new Date(data._seconds * 1000 + data._nanoseconds / 1000000).toISOString();
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
    data: CreateClientInput & { priceId?: string | null } // priceId is now expected here for paid tiers
): Promise<{ success: boolean; error?: string; checkoutUrl?: string | null }> {

    // PATH 1: FREE TIER SIGNUP
    if (data.tier === 'free' || !data.priceId) { // Also handle cases where priceId might be missing for safety
        let uid = '';
        try {
            // Create a Stripe customer even for free users for future upgrades
            const stripeCustomer = await stripe.customers.create({ email: data.email, name: data.fullName });

            // Create Firebase Auth user
            const userRecord = await auth.createUser({
                email: data.email,
                password: data.password,
                displayName: data.fullName,
                emailVerified: false,
            });
            uid = userRecord.uid;

            // Set custom claims for role-based access
            await auth.setCustomUserClaims(uid, { role: 'client', tier: 'free' });

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
                tier: 'free',
                role: 'client',
                stripeCustomerId: stripeCustomer.id,
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
            console.error("Error in free tier signup of unifiedSignupAction:", error);
            if (uid) {
                await auth.deleteUser(uid).catch(delError => console.error(`Failed to clean up auth user ${uid}`, delError));
            }
            return { success: false, error: error.message || 'An unknown error occurred during free signup.' };
        }
    }

    // PATH 2: PAID TIER SIGNUP
    try {
        const returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const successUrl = `${returnUrl}/client/dashboard?signup=success`;
        const cancelUrl = `${returnUrl}/signup`;

        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: data.priceId, quantity: 1 }],
            mode: 'subscription',
            customer_email: data.email, 
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userData: JSON.stringify(data)
            }
        });

        if (!checkoutSession.url) {
            throw new Error("Could not create Stripe checkout session.");
        }

        return { success: true, checkoutUrl: checkoutSession.url };

    } catch (error: any) {
        console.error("Error creating paid checkout session:", error);
        return { success: false, error: error.message };
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
        const stripeCustomer = await stripe.customers.create({ email: data.email, name: data.fullName });
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
            tier: data.tier,
            role: 'client',
            stripeCustomerId: stripeCustomer.id,
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

// SURGICAL ADDITION: New action to get chat details by ID for notifications
export async function getChatDetailsAction(chatId: string): Promise<{ success: boolean; data?: { id: string; name: string; }; error?: string; }> {
    try {
        if (!chatId) throw new Error("Chat ID is required.");
        const chatRef = adminDb.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists) return { success: false, error: "Chat not found." };

        const chatData = chatSnap.data() as Chat;
        return { success: true, data: { id: chatSnap.id, name: chatData.name || 'Unnamed Chat' } };
    } catch (error: any) {
        console.error(`Error fetching chat details for ${chatId}:`, error);
        return { success: false, error: error.message };
    }
}
