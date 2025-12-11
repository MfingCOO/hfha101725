'use server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile, NutritionalGoals } from '@/types';
import { calculateNutritionalGoals } from '@/services/goals';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});

// This internal function creates the user in Firebase and sets up all associated data.
async function createUserFromStripe(session: Stripe.Checkout.Session) {
    const userDataString = session.metadata?.userData;
    if (!userDataString) {
        throw new Error("Webhook Error: checkout.session.completed event is missing userData in metadata.");
    }
    const data = JSON.parse(userDataString);
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!customerId) {
        throw new Error("Webhook Error: Customer ID is missing in the Stripe session.");
    }

    let uid = '';
    try {
        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.fullName,
            emailVerified: true,
        });
        uid = userRecord.uid;

        // THE FIX: The data from Stripe metadata is just a string. 
        // We need to convert `birthdate` back to a Date object before passing it to the calculator.
        if (data.birthdate) {
            data.birthdate = new Date(data.birthdate);
        }

        const batch = adminDb.batch();

        // 1. Create the userProfile document
        const userProfileRef = adminDb.collection('userProfiles').doc(uid);
        batch.set(userProfileRef, {
            uid: uid,
            email: data.email,
            fullName: data.fullName,
            tier: data.tier,
            role: 'client',
            stripeCustomerId: customerId,
            chatIds: [],
            challengeIds: [],
        });

        // 2. Prepare the client document data
        const { password, ...onboardingData } = data;

        const clientDataForGoals: Partial<ClientProfile> = {
            uid: uid,
            email: data.email,
            fullName: data.fullName,
            tier: data.tier,
            onboarding: onboardingData,
            stripeCustomerId: customerId,
        };

        const initialGoals = calculateNutritionalGoals(clientDataForGoals as ClientProfile);

        const clientDocRef = adminDb.collection('clients').doc(uid);

        batch.set(clientDocRef, {
            ...clientDataForGoals,
            createdAt: Timestamp.now(),
            suggestedGoals: initialGoals,
            customGoals: initialGoals,
        });

        await batch.commit();
        console.log(`[WEBHOOK] Successfully created user ${uid} and client documents.`);
        return { success: true, uid: uid };

    } catch (error: any) {
        console.error(`[WEBHOOK] Error in createUserFromStripe for UID: ${uid}`, error);
        if (uid) {
            await auth.deleteUser(uid).catch(e => console.error(`[WEBHOOK] Cleanup failed for UID: ${uid}`, e));
        }
        throw error;
    }
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    // THE FIX: headers() returns a Promise, so we must await it.
    const signature = (await headers()).get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error('[WEBHOOK] Error constructing event:', err.message);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                console.log('[WEBHOOK] Received checkout.session.completed event.');
                const session = event.data.object as Stripe.Checkout.Session;
                await createUserFromStripe(session);
                break;
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                console.log(`[WEBHOOK] Received ${event.type} event.`);
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
                
                const users = await adminDb.collection('userProfiles').where('stripeCustomerId', '==', customerId).limit(1).get();
                if (!users.empty) {
                    const userDoc = users.docs[0];
                    const newTier = subscription.items.data[0]?.price.metadata.tier as | 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching' || 'free';
                    await userDoc.ref.update({ tier: event.type === 'customer.subscription.deleted' ? 'free' : newTier });
                    console.log(`[WEBHOOK] Updated user ${userDoc.id} tier to ${newTier}.`);
                } else {
                     console.warn(`[WEBHOOK] Could not find user for stripeCustomerId: ${customerId}`);
                }
                break;
            default:
                console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
        }

        return new NextResponse(JSON.stringify({ received: true }), { status: 200 });

    } catch (error: any) {
        console.error('[WEBHOOK] Handler error:', error.message);
        return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
