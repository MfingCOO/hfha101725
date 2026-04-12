'use server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile, UserTier } from '@/types';

function isRevenueCatWebhook(reqBody: any): boolean {
    return reqBody && typeof reqBody === 'object' && reqBody.event && reqBody.event.app_user_id && reqBody.event.type;
}

async function processRevenueCatEvent(eventPayload: any): Promise<{ success: boolean; error?: string }> {
    console.log('[REVENUECAT WEBHOOK] Processing RevenueCat event:', eventPayload.event.type);
    
    const revenueCatEvent = eventPayload.event;
    const appUserID = revenueCatEvent.app_user_id;
    
    if (!appUserID) {
        console.error('[REVENUECAT WEBHOOK] Missing app_user_id in event payload.');
        return { success: false, error: 'Missing App User ID.' };
    }

    try {
        const clientRef = adminDb.collection('clients').doc(appUserID);
        let clientSnap = await clientRef.get();
        let newTier: UserTier = 'free';

        const activeEntitlements = revenueCatEvent.entitlements || {};
        
        if (activeEntitlements.premium_access) {
            newTier = 'premium';
        } else if (activeEntitlements.basic_access) {
            newTier = 'basic';
        } else if (activeEntitlements.ad_free_access) {
            newTier = 'ad-free';
        }

        if (!clientSnap.exists) {
            console.warn(`[REVENUECAT WEBHOOK] Client with UID ${appUserID} not found. Creating a new client record from webhook.`);
            
            const authUser = await auth.getUser(appUserID);
            if (!authUser) {
                throw new Error(`Firebase Auth user not found for UID: ${appUserID}`);
            }

            const clientPayload: Partial<ClientProfile> = {
                uid: appUserID,
                email: authUser.email || '',
                fullName: authUser.displayName || 'New Client',
                tier: newTier,
                role: 'client',
                createdAt: FieldValue.serverTimestamp(),
                revenueCatLastEvent: revenueCatEvent.type,
                revenueCatEntitlements: activeEntitlements,
                hasLoggedInBefore: false,
                onboarding: {
                    // Pre-fill with placeholder data; user should be prompted to complete this
                    disclaimer: true,
                    units: 'imperial', // Defaulting to imperial as per your instruction
                },
            };

            await clientRef.set(clientPayload);
            console.log(`[REVENUECAT WEBHOOK] Successfully created new client ${appUserID} with tier ${newTier}.`);

        } else {
             await clientRef.update({
                tier: newTier,
                revenueCatLastEvent: revenueCatEvent.type,
                revenueCatEntitlements: activeEntitlements,
                lastActivity: FieldValue.serverTimestamp(),
            });
            console.log(`[REVENUECAT WEBHOOK] Successfully updated user ${appUserID} to tier ${newTier} based on event ${revenueCatEvent.type}.`);
        }
        
        // Set custom claims for role-based access
        await auth.setCustomUserClaims(appUserID, { role: 'client', tier: newTier });

        return { success: true };

    } catch (error: any) {
        console.error(`[REVENUECAT WEBHOOK] Error processing event for user ${appUserID}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred processing RevenueCat event.' };
    }
}

export async function POST(req: NextRequest) {
    let jsonBody: any; 

    try {
        jsonBody = await req.json();
    } catch (jsonError) {
        const rawBody = await req.text();
        console.error("Failed to parse JSON:", jsonError);
        console.log("Raw body:", rawBody);
        return new NextResponse(`Webhook Error: Invalid JSON format.`, { status: 400 });
    }

    if (isRevenueCatWebhook(jsonBody)) {
        const result = await processRevenueCatEvent(jsonBody); 
        if (result.success) {
            return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
        } else {
            return new NextResponse(JSON.stringify({ error: result.error }), { status: 500 });
        }
    } else {
        console.warn('[WEBHOOK] Received unknown webhook origin. Request body:', JSON.stringify(jsonBody));
        return new NextResponse(`Webhook Error: Unknown origin. Only RevenueCat webhooks are processed here.`, { status: 400 });
    }
}
