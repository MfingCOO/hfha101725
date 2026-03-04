'use server';

import { db as adminDb, auth } from '@/lib/firebaseAdmin';
import type { ClientProfile, CoachNote, CreateClientInput, UserTier } from '@/types';
import Stripe from 'stripe';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateIdealBodyWeight, calculateNutritionalGoals } from '@/services/goals';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});

// This is a new, more robust serialization function
function serializeTimestamps(data: any): any {
    if (data === null || data === undefined || typeof data !== 'object') {
        return data;
    }

    // Firestore Timestamps have toDate(), plain objects from server actions might not
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }

    // Handle object representations of Timestamps from different Firebase SDK versions
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

        // --- START OF FIX ---
        // The previous attempt failed because calculateIdealBodyWeight was called with an object instead of two arguments.
        // Correct Call: Pass the height and units directly.
        const idealBodyWeight = calculateIdealBodyWeight(data.height, data.units);

        // Now, construct the profile object needed for the calculateNutritionalGoals function.
        const tempProfileForCalc: Partial<ClientProfile> = {
            onboarding: { ...data, birthdate: new Date(data.birthdate) },
            idealBodyWeight: idealBodyWeight, // Pass the correctly calculated value.
            height: { 
                value: data.height, 
                unit: data.units === 'imperial' ? 'in' : 'cm' 
            }
        };

        // This function now receives an object with the correct idealBodyWeight.
        const { idealGoals, actualGoals } = calculateNutritionalGoals(tempProfileForCalc as ClientProfile);
        // --- END OF FIX ---
        
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
            idealBodyWeight: idealBodyWeight, // Store the correct value
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

export async function unifiedSignupAction(
    data: CreateClientInput,
    billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; checkoutUrl?: string | null }> {
    
    try {
        let priceId: string | undefined;
        if (billingCycle === 'monthly') {
            switch (data.tier) {
                case 'free': priceId = process.env.STRIPE_FREE_MONTHLY_PRICE_ID; break;
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_MONTHLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_MONTHLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_MONTHLY_PRICE_ID; break;
            }
        } else { // yearly
            switch (data.tier) {
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_YEARLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_YEARLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_YEARLY_PRICE_ID; break;
            }
        }

        if (!priceId) {
            throw new Error(`Price ID for tier "${data.tier}" with billing cycle "${billingCycle}" is not configured.`);
        }

        const returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const successUrl = `${returnUrl}/login?signup=success`;
        const cancelUrl = `${returnUrl}/signup`;

        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userData: JSON.stringify(data)
            }
        });

        if (!checkoutSession.url) throw new Error("Could not create Stripe checkout session.");

        return { success: true, checkoutUrl: checkoutSession.url };

    } catch (error: any) {
        console.error("Error creating paid checkout session:", error);
        return { success: false, error: error.message };
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
        
        // THE FIX: Use a robust serialization function to handle all timestamp formats
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
            createdAt: FieldValue.serverTimestamp(), // Use server timestamp for consistency
        };
        
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`);
        const newNoteRef = await notesRef.add(noteData);

        // THE FIX: Return the newly created note so the UI can update instantly
        const newNote: CoachNote = {
            id: newNoteRef.id,
            text,
            coachId,
            coachName,
            clientId,
            createdAt: new Date().toISOString(), // Provide an immediate timestamp for the UI
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
