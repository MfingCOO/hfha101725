'use server';

import { db as adminDb, auth as adminAuth } from '@/lib/firebaseAdmin';
import type { TrackingSettings, ClientProfile, NutritionalGoals } from '@/types';
import { uploadImageAction } from '@/app/coach/actions';
import { calculateNutritionalGoals } from '@/services/goals';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-04-10',
});


/**
 * Creates a Stripe Checkout session to allow a user to start a new subscription.
 * This function now supports both 'monthly' and 'yearly' billing cycles.
 */
export async function createStripeCheckoutSession(
    clientId: string,
    tier: 'ad-free' | 'basic' | 'premium' | 'coaching',
    billingCycle: 'monthly' | 'yearly'
): Promise<{ url?: string; error?: string; }> {
    try {
        if (!clientId) throw new Error("Client ID is required.");

        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) throw new Error("Client profile not found.");

        const clientData = clientSnap.data() as ClientProfile;
        const stripeCustomerId = clientData.stripeCustomerId;
        if (!stripeCustomerId) throw new Error("Stripe customer ID not found for this client.");

        let priceId: string | undefined;

        if (billingCycle === 'monthly') {
            switch (tier) {
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_MONTHLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_MONTHLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_MONTHLY_PRICE_ID; break;
            }
        } else { // yearly
            switch (tier) {
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_YEARLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_YEARLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_YEARLY_PRICE_ID; break;
            }
        }


        if (!priceId) throw new Error(`Price ID for tier "${tier}" with billing cycle "${billingCycle}" is not configured in environment variables.`);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${baseUrl}/client/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/client/dashboard`,
        });

        if (!checkoutSession.url) throw new Error("Could not create Stripe checkout session.");
        
        return { url: checkoutSession.url };
        
    } catch (error: any) {
        console.error("Error creating Stripe checkout session:", error);
        return { error: error.message };
    }
}


/**
 * Creates a Stripe Customer Portal session and returns the URL.
 * Creates a Stripe Customer if one doesn't exist.
 */
export async function createStripePortalSession(clientId: string): Promise<{ url?: string; error?: string; }> {
    try {
        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) {
            throw new Error("Client profile not found.");
        }

        const portalConfigId = process.env.STRIPE_PORTAL_CONFIG_ID;
        if (!portalConfigId) {
            console.error('[PORTAL_ACTION] CRITICAL SERVER MISCONFIGURATION: STRIPE_PORTAL_CONFIG_ID is not set.');
            return { error: 'Server configuration error. Please contact support.' };
        }

        const clientData = clientSnap.data() as ClientProfile;
        let stripeCustomerId = clientData.stripeCustomerId;

        // If the user doesn't have a Stripe Customer ID, create one.
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: clientData.email,
                name: clientData.fullName,
                metadata: {
                    firebaseUID: clientId,
                },
            });
            stripeCustomerId = customer.id;
            await clientRef.update({ stripeCustomerId });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${baseUrl}/client/dashboard`,
            configuration: portalConfigId,
        });

        return { url: portalSession.url };

    } catch (error: any) {
        console.error("Error creating Stripe portal session:", error);
        return { error: error.message };
    }
}


/**
 * Updates a client's settings. This is the corrected function that prevents data corruption.
 */
export async function updateClientSettingsAction(clientId: string, settings: Partial<TrackingSettings>): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);
        const userProfileRef = adminDb.collection('userProfiles').doc(clientId);

        const updatePayload: { [key: string]: any } = {};

        // Use dot notation to safely update nested fields without overwriting the parent object
        for (const key in settings) {
            if (Object.prototype.hasOwnProperty.call(settings, key)) {
                const value = settings[key as keyof TrackingSettings];
                if (key === 'units') {
                    updatePayload['onboarding.units'] = value;
                } else {
                    updatePayload[`trackingSettings.${key}`] = value;
                }
            }
        }

        if (Object.keys(updatePayload).length > 0) {
            const batch = adminDb.batch();
            batch.update(clientRef, updatePayload);
            batch.update(userProfileRef, updatePayload);
            await batch.commit();
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating settings for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Master action to update a client's profile settings and recalculate nutritional goals.
 */
export async function updateClientProfileAndGoalsAction(
    clientId: string,
    data: {
        activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
        calculationMode?: 'ideal' | 'actual' | 'custom';
        calorieModifier?: number;
        customMacros?: { protein?: number | ''; fat?: number | ''; carbs?: number | '' };
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) {
            throw new Error("Client profile not found.");
        }
        
        const existingClientData = clientSnap.data() as ClientProfile;

        const tempProfileForCalc: ClientProfile = {
            ...existingClientData,
            customGoals: {
                ...(existingClientData.customGoals || {}),
                calculationMode: data.calculationMode ?? existingClientData.customGoals?.calculationMode ?? 'ideal',
                activityLevel: data.activityLevel ?? existingClientData.customGoals?.activityLevel ?? existingClientData.onboarding?.activityLevel ?? 'light',
                calorieModifier: data.calorieModifier ?? existingClientData.customGoals?.calorieModifier ?? 0,
                protein: typeof data.customMacros?.protein === 'number' ? data.customMacros.protein : undefined,
                fat: typeof data.customMacros?.fat === 'number' ? data.customMacros.fat : undefined,
                carbs: data.customMacros?.carbs === '' ? undefined : (typeof data.customMacros?.carbs === 'number' ? data.customMacros.carbs : undefined),
            },
        };

        if (!tempProfileForCalc.customGoals) {
            throw new Error('Internal server error: Could not initialize goal calculation data.');
        }

        const allGoalSets = calculateNutritionalGoals(tempProfileForCalc);
        
        let goalsToSave: NutritionalGoals;
        switch (tempProfileForCalc.customGoals.calculationMode) {
            case 'ideal':
                goalsToSave = allGoalSets.idealGoals;
                break;
            case 'actual':
                goalsToSave = allGoalSets.actualGoals;
                break;
            case 'custom':
                goalsToSave = allGoalSets.customGoals;
                break;
            default:
                goalsToSave = allGoalSets.idealGoals;
                break;
        }

        await clientRef.update({
            customGoals: goalsToSave,
            'onboarding.activityLevel': tempProfileForCalc.customGoals.activityLevel
        });

        return { success: true };

    } catch (error: any) {
        console.error(`Error updating profile and goals for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Updates a user's profile information in Auth and Firestore.
 */
export async function updateUserProfileAction(uid: string, data: { fullName?: string; email?: string; phone?: string; photoURL?: string; }): Promise<{ success: boolean; error?: string }> {
    try {
        const { photoURL, ...restData } = data;
        let finalPhotoUrl = photoURL;

        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
            const uploadResult = await uploadImageAction(finalPhotoUrl, `profile-pictures/${uid}`);
            if (uploadResult.success && uploadResult.url) {
                finalPhotoUrl = uploadResult.url;
            } else {
                throw new Error(uploadResult.error || 'Failed to upload new profile picture.');
            }
        }

        const authUpdatePayload: any = {};
        if (restData.fullName) authUpdatePayload.displayName = restData.fullName;
        if (restData.email) authUpdatePayload.email = restData.email;
        if (finalPhotoUrl) authUpdatePayload.photoURL = finalPhotoUrl;

        if (Object.keys(authUpdatePayload).length > 0) {
            await adminAuth.updateUser(uid, authUpdatePayload);
        }
        
        const profileRef = adminDb.collection('userProfiles').doc(uid);
        const firestoreUpdatePayload: any = { ...restData };
        if (finalPhotoUrl) firestoreUpdatePayload.photoURL = finalPhotoUrl;

        if(Object.keys(firestoreUpdatePayload).length > 0) {
            await profileRef.set(firestoreUpdatePayload, { merge: true });
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating profile for user ${uid}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates a user's password in Firebase Auth.
 */
export async function updateUserPasswordAction(uid: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        await adminAuth.updateUser(uid, { password: newPassword });
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating password for user ${uid}:`, error);
        return { success: false, error: error.message };
    }
}
