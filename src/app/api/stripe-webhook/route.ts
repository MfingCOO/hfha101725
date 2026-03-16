'use server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import FieldValue
import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile, UserTier } from '@/types';
import { calculateNutritionalGoals } from '@/services/goals';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});

// Helper to determine if a webhook is from Stripe
function isStripeWebhook(reqHeaders: Headers): boolean {
    return reqHeaders.has('stripe-signature');
}

// Helper to determine if a webhook is from RevenueCat
// RevenueCat webhooks typically have a 'event' object with 'type', 'app_user_id', etc.
// A more robust check might involve a shared secret signature verification, which is not implemented here.
function isRevenueCatWebhook(reqBody: any): boolean {
    return reqBody && typeof reqBody === 'object' && reqBody.event && reqBody.event.app_user_id && reqBody.event.type;
}

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

    const DEFAULT_COACH_ID = 'yue7fVPBQZg45vmfXXUH5PdG7jE2';

    let uid = '';
    try {
        const userRecord = await auth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.fullName,
            emailVerified: true,
        });
        uid = userRecord.uid;

        // Ensure birthdate is a Date object if present
        if (data.birthdate) {
            data.birthdate = new Date(data.birthdate);
        }

        const { password, ...onboardingData } = data;

        // FIX: Removed 'role' property to align with ClientProfile type
        const clientDataForGoals: Partial<ClientProfile> = {
            uid: uid,
            email: data.email,
            fullName: data.fullName,
            tier: data.tier,
            onboarding: onboardingData,
            stripeCustomerId: customerId,
            coachId: DEFAULT_COACH_ID,
            chatIds: [],
            challengeIds: [],
        };

        const initialGoals = calculateNutritionalGoals(clientDataForGoals as ClientProfile);
        const clientDocRef = adminDb.collection('clients').doc(uid);

        await clientDocRef.set({
            ...clientDataForGoals,
            createdAt: Timestamp.now(),
            suggestedGoals: initialGoals,
            customGoals: initialGoals,
        });

        console.log(`[WEBHOOK] Successfully created user ${uid} and client document.`);
        return { success: true, uid: uid };

    } catch (error: any) {
        console.error(`[WEBHOOK] Error in createUserFromStripe for UID: ${uid}`, error);
        if (uid) {
            await auth.deleteUser(uid).catch(e => console.error(`[WEBHOOK] Cleanup failed for UID: ${uid}`, e));
        }
        throw error;
    }
}

// NEW: Function to process RevenueCat events
async function processRevenueCatEvent(eventPayload: any): Promise<{ success: boolean; error?: string }> {
    console.log('[REVENUECAT WEBHOOK] Processing RevenueCat event:', eventPayload.event.type);
    
    const revenueCatEvent = eventPayload.event;
    const appUserID = revenueCatEvent.app_user_id; // This should be your Firebase UID
    
    if (!appUserID) {
        console.error('[REVENUECAT WEBHOOK] Missing app_user_id in event payload.');
        return { success: false, error: 'Missing App User ID.' };
    }

    try {
        const clientRef = adminDb.collection('clients').doc(appUserID);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) {
            console.warn(`[REVENUECAT WEBHOOK] Client with UID ${appUserID} not found in Firestore. This might indicate an issue with appUserID mapping or user creation.`);
            // For robustness, you might want to create a new user here if it's a legitimate first purchase,
            // but for now, we assume the user already exists in Firebase/Firestore.
            return { success: false, error: `Client with UID ${appUserID} not found.` };
        }

        const clientData = clientSnap.data() as ClientProfile;
        let newTier: UserTier = clientData.tier; // Default to current tier

        // Map RevenueCat entitlements to your internal UserTier
        // This mapping logic needs to be robust and match your RevenueCat configuration.
        const activeEntitlements = revenueCatEvent.entitlements; 
        
        // Determine the highest active tier based on entitlements
        if (activeEntitlements && activeEntitlements.premium_access && activeEntitlements.premium_access.expires_date) {
            newTier = 'premium';
        } else if (activeEntitlements && activeEntitlements.basic_access && activeEntitlements.basic_access.expires_date) {
            newTier = 'basic';
        } else if (activeEntitlements && activeEntitlements.ad_free_access && activeEntitlements.ad_free_access.expires_date) {
            newTier = 'ad-free';
        } else {
            newTier = 'free'; // If no active entitlements, downgrade to free
        }


        // Update Firestore client document
        await clientRef.update({
            tier: newTier,
            revenueCatLastEvent: revenueCatEvent.type, // Store last RC event type
            revenueCatEntitlements: activeEntitlements, // Store raw entitlements for debugging
            lastActivity: FieldValue.serverTimestamp(), // Update last activity
        });

        console.log(`[REVENUECAT WEBHOOK] Successfully updated user ${appUserID} to tier ${newTier} based on event ${revenueCatEvent.type}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[REVENUECAT WEBHOOK] Error processing event for user ${appUserID}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred processing RevenueCat event.' };
    }
}

export async function POST(req: NextRequest) {
    const resolvedHeaders = await headers(); // FIX: Await headers() call
    let rawBody: string; 
    let jsonBody: any; 

    // Attempt to parse as JSON first
    try {
        jsonBody = await req.json();
        rawBody = JSON.stringify(jsonBody); 
    } catch (jsonError) {
        // If JSON parsing fails, assume it's raw text
        rawBody = await req.text();
        jsonBody = {}; 
    }

    if (isStripeWebhook(resolvedHeaders)) { // FIX: Use resolvedHeaders
        // --- Stripe Webhook Handling --- 
        const signature = resolvedHeaders.get('stripe-signature') as string; // FIX: Use resolvedHeaders

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET!
            );
        } catch (err: any) {
            console.error('[STRIPE WEBHOOK] Error constructing event:', err.message);
            return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    console.log('[STRIPE WEBHOOK] Received checkout.session.completed event.');
                    const session = event.data.object as Stripe.Checkout.Session;
                    await createUserFromStripe(session);
                    break;
                
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    console.log(`[STRIPE WEBHOOK] Received ${event.type} event.`);
                    const subscription = event.data.object as Stripe.Subscription;
                    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

                    if (!customerId) {
                        throw new Error("Webhook Error: Customer ID is missing in the subscription event.");
                    }

                    await adminDb.runTransaction(async (transaction) => {
                        const clientQuery = adminDb.collection('clients').where('stripeCustomerId', '==', customerId).limit(1);
                        const clientSnapshot = await transaction.get(clientQuery);

                        if (clientSnapshot.empty) {
                            console.warn(`[STRIPE WEBHOOK] Transaction failed: Could not find client for stripeCustomerId: ${customerId}`);
                            return;
                        }

                        const clientDoc = clientSnapshot.docs[0];
                        const uid = clientDoc.id;

                        const isDeletion = event.type === 'customer.subscription.deleted';
                        const newTier = isDeletion 
                            ? 'free' 
                            : subscription.items.data[0]?.price.metadata.tier as UserTier || 'free';

                        transaction.update(clientDoc.ref, { tier: newTier });

                        console.log(`[STRIPE WEBHOOK] Transaction success: Updated user ${uid} to tier ${newTier}.`);
                    });
                    break;

                default:
                    console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
            }

            return new NextResponse(JSON.stringify({ received: true }), { status: 200 });

        } catch (error: any) {
            console.error('[STRIPE WEBHOOK] Handler error:', error.message);
            return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
        }

    } else if (isRevenueCatWebhook(jsonBody)) {
        // --- RevenueCat Webhook Handling --- 
        const result = await processRevenueCatEvent(jsonBody); 
        if (result.success) {
            return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
        } else {
            return new NextResponse(JSON.stringify({ error: result.error }), { status: 500 });
        }
    } else {
        console.warn('[WEBHOOK] Received unknown webhook origin. Request body:', rawBody);
        return new NextResponse(`Webhook Error: Unknown origin`, { status: 400 });
    }
}
