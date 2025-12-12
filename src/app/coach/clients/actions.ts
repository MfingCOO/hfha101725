'use server';

import { db as adminDb, auth } from '@/lib/firebaseAdmin';
import type { ClientProfile, CoachNote, CreateClientInput, UserTier } from '@/types';
import Stripe from 'stripe';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});

function serializeTimestamps(data: any): any {
    if (data === null || data === undefined) return data;
    if (data instanceof Timestamp) return data.toDate().toISOString();
    if (Array.isArray(data)) return data.map(serializeTimestamps);
    if (typeof data === 'object' && Object.prototype.toString.call(data) === '[object Object]') {
        const newObject: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObject[key] = serializeTimestamps(data[key]);
            }
        }
        return newObject;
    }
    return data;
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

        if (!height || !height.value || !height.unit) {
            return { success: false, error: "Client height is not set." };
        }

        let wthr;
        if (height.unit === 'in') {
            wthr = waist / height.value;
        } else { // cm
            wthr = waist / (height.value * 0.393701); // convert cm to inches
        }

        await clientRef.update({ wthr: wthr });

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating WTHR for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Server action for a COACH to create a new client. 
 * CORRECTED: This now writes to the 'clients' collection as originally intended.
 */
export async function createClientByCoachAction(data: CreateClientInput): Promise<{ success: boolean; uid?: string; error?: any; }> {
    try {
        const stripeCustomer = await stripe.customers.create({ email: data.email, name: data.fullName });

        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.fullName,
            emailVerified: true,
        });

        const clientProfile: Omit<ClientProfile, 'uid'> = {
            email: data.email,
            fullName: data.fullName,
            tier: data.tier as UserTier,
            coachId: data.coachId,
            stripeCustomerId: stripeCustomer.id,
            createdAt: FieldValue.serverTimestamp(),
            height: { value: data.height, unit: data.units === 'imperial' ? 'in' : 'cm' },
            onboarding: { ...data },
        };
        
        // SURGICAL FIX: Writing to the 'clients' collection.
        await adminDb.collection('clients').doc(userRecord.uid).set(clientProfile);

        if (data.tier === 'coaching') {
            const chatRef = adminDb.collection('chats').doc();
            await chatRef.set({
                name: `${data.fullName} & Coach`,
                type: 'coaching',
                participants: [userRecord.uid, data.coachId],
                participantCount: 2,
                ownerId: data.coachId,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        return { success: true, uid: userRecord.uid };
    
    } catch (error: any) {
        console.error("Error in createClientByCoachAction:", error);
        return { success: false, error: { message: error.message || 'An unknown error occurred' } };
    }
}

export async function unifiedSignupAction(
    data: CreateClientInput,
    billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; checkoutUrl?: string | null }> {
    
    if (data.tier === 'free' || data.tier === 'ad-free') {
        const result = await createClientByCoachAction(data);
        if (result.success) {
            return { success: true, checkoutUrl: null };
        } else {
            return { success: false, error: result.error?.message || "Failed to create free user account." };
        }
    }

    try {
        let priceId: string | undefined;
        if (billingCycle === 'monthly') {
            switch (data.tier) {
                case 'basic': priceId = process.env.STRIPE_BASIC_MONTHLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_MONTHLY_PRICE_ID; break;
            }
        } else { // yearly
            switch (data.tier) {
                case 'basic': priceId = process.env.STRIPE_BASIC_YEARLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID; break;
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
                // BUG FIX: The webhook needs the complete user data, including the password,
                // to create the Firebase Auth user after successful payment.
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
        // SURGICAL FIX: Deleting from 'clients' collection
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
        // SURGICAL FIX: Reading from 'clients' collection
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`).orderBy('createdAt', 'desc');
        const snapshot = await notesRef.get();
        const notes = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                text: data.text,
                coachName: data.coachName,
                coachId: data.coachId,
                clientId: clientId,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            };
        });
        return { success: true, data: notes as CoachNote[] };
    } catch (error: any) {
        console.error("Error fetching coach notes:", error);
        return { success: false, error: error.message };
    }
}

export async function addCoachNoteAction(clientId: string, text: string, coachId: string, coachName: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!text.trim()) return { success: false, error: "Note cannot be empty." };
        const noteData = {
            text,
            coachId,
            coachName,
            createdAt: FieldValue.serverTimestamp(),
        };
        // SURGICAL FIX: Writing to 'clients' collection
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`);
        await notesRef.add(noteData);
        return { success: true };
    } catch (error: any) {
        console.error("Error adding coach note:", error);
        return { success: false, error: error.message };
    }
}

export async function getClientByIdAction(clientId: string): Promise<{ success: boolean; data?: ClientProfile; error?: string }> {
    try {
        if (!clientId) throw new Error("Client ID is required.");
        // SURGICAL FIX: Reading from 'clients' collection
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

// SURGICAL ADDITION: Restoring the mistakenly deleted function.
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
