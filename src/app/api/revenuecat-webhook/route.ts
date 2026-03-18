'use server';
import { NextRequest, NextResponse } from 'next/server';
// REMOVED: import Stripe from 'stripe';
import { headers } from 'next/headers';
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import FieldValue
import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile, UserTier } from '@/types';
import { calculateNutritionalGoals } from '@/services/goals';

// REMOVED: const stripe = new Stripe(process.env.STRIPE_API_KEY!, {...});

// REMOVED: function isStripeWebhook(reqHeaders: Headers): boolean {...}

// Helper to determine if a webhook is from RevenueCat
// RevenueCat webhooks typically have a 'event' object with 'type', 'app_user_id', etc.
// A more robust check might involve a shared secret signature verification, which is not implemented here.
function isRevenueCatWebhook(reqBody: any): boolean {
    return reqBody && typeof reqBody === 'object' && reqBody.event && reqBody.event.app_user_id && reqBody.event.type;
}

// REMOVED: async function createUserFromStripe(session: Stripe.Checkout.Session) {...}

// Function to process RevenueCat events (REMAINS UNTOUCHED)
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
    const resolvedHeaders = await headers(); 
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

    // MODIFIED: Only process RevenueCat webhooks
    if (isRevenueCatWebhook(jsonBody)) {
        // --- RevenueCat Webhook Handling --- 
        const result = await processRevenueCatEvent(jsonBody); 
        if (result.success) {
            return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
        } else {
            return new NextResponse(JSON.stringify({ error: result.error }), { status: 500 });
        }
    } else {
        console.warn('[WEBHOOK] Received unknown webhook origin. Request body:', rawBody);
        return new NextResponse(`Webhook Error: Unknown origin. Only RevenueCat webhooks are processed here.`, { status: 400 });
    }
}
