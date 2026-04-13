import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { UserTier } from '@/types';

function isRevenueCatWebhook(reqBody: any): boolean {
    return reqBody && typeof reqBody === 'object' && reqBody.event && reqBody.event.app_user_id && reqBody.event.type;
}

async function processRevenueCatEvent(eventPayload: any): Promise<{ success: boolean; error?: string }> {
    console.log('[REVENUECAT WEBHOOK] Processing event:', eventPayload.event.type);
    
    const { event } = eventPayload;
    const { app_user_id: appUserID, entitlements } = event;
    
    if (!appUserID) {
        console.error('[REVENUECAT WEBHOOK] Missing app_user_id.');
        return { success: false, error: 'Missing App User ID.' };
    }

    try {
        const clientRef = adminDb.collection('clients').doc(appUserID);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) {
            console.warn(`[REVENUECAT WEBHOOK] Client with UID ${appUserID} not found.`);
            return { success: false, error: `Client with UID ${appUserID} not found.` };
        }

        let newTier: UserTier = 'free';
        if (entitlements?.premium_tier) newTier = 'premium';
        else if (entitlements?.basic_tier) newTier = 'basic';
        else if (entitlements?.ad_free_tier) newTier = 'ad-free';

        await clientRef.update({
            tier: newTier,
            status: 'active',
            revenueCatLastEvent: event.type,
            revenueCatEntitlements: entitlements,
            lastActivity: FieldValue.serverTimestamp(),
        });

        await auth.updateUser(appUserID, { disabled: false });
        await auth.setCustomUserClaims(appUserID, { role: 'client', tier: newTier });

        console.log(`[REVENUECAT WEBHOOK] Successfully updated user ${appUserID} to tier ${newTier}.`);
        return { success: true };

    } catch (error: any) {
        console.error(`[REVENUECAT WEBHOOK] Error processing event for user ${appUserID}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
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
        return new NextResponse('Webhook Error: Invalid JSON format.', { status: 400 });
    }

    if (isRevenueCatWebhook(jsonBody)) {
        const result = await processRevenueCatEvent(jsonBody);
        if (result.success) {
            return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
        } else {
            return new NextResponse(JSON.stringify({ error: result.error }), { status: 500 });
        }
    } else {
        console.warn('[WEBHOOK] Received unknown webhook origin.');
        return new NextResponse('Webhook Error: Unknown origin.', { status: 400 });
    }
}