'use server';

import { admin, db as adminDb, auth as adminAuth } from '@/lib/firebaseAdmin'; // FIXED: Added admin import
import type { ClientProfile } from '@/types';
// REMOVED: import { uploadImageAction } from '@/app/coach/actions'; // This import is no longer needed here
import { calculateNutritionalGoals } from '@/services/goals';
// REMOVED: import Stripe from 'stripe';

// Inlined type definitions to avoid client-side module errors
export interface TrackingSettings {
    nutrition?: boolean;
    hydration?: boolean;
    activity?: boolean;
    sleep?: boolean;
    stress?: boolean;
    measurements?: boolean;
    units?: 'imperial' | 'metric';
    reminders?: boolean;
}

export interface NutritionalGoals {
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    calculationMode: 'ideal' | 'actual' | 'custom';
    calorieModifier: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    calorieGoal?: number;
    calorieGoalRange?: { min: number; max: number; };
    tdee?: number;
}

// REMOVED: const stripe = new Stripe(process.env.STRIPE_API_KEY!, {...});


// REMOVED: /**
// REMOVED:  * Creates a Stripe Checkout session to allow a user to start a new subscription.
// REMOVED:  * This function now supports both 'monthly' and 'yearly' billing cycles.
// REMOVED:  */
// REMOVED: export async function createStripeCheckoutSession(...): Promise<{ url?: string; error?: string; }> {...}



// REMOVED: /**
// REMOVED:  * Creates a Stripe Customer Portal session and returns the URL.
// REMOVED:  * Creates a Stripe Customer if one doesn't exist.
// REMOVED:  */
// REMOVED: export async function createStripePortalSession(clientId: string): Promise<{ url?: string; error?: string; }> {...}


/**
 * Updates a client's settings. This is the corrected function that prevents data corruption.
 */
export async function updateClientSettingsAction(clientId: string, settings: Partial<TrackingSettings>): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);

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
            await clientRef.update(updatePayload);
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
            // Extract MIME type and base64 data
            const mimeType = finalPhotoUrl.substring(finalPhotoUrl.indexOf(':') + 1, finalPhotoUrl.indexOf(';'));
            const base64Data = finalPhotoUrl.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // FIX: Correctly access admin.storage()
            const bucket = admin.storage().bucket(); 
            const filePath = `profile-pictures/${uid}/${Date.now()}-profile-pic.${mimeType.split('/')[1]}`;
            const fileRef = bucket.file(filePath);

            await fileRef.save(imageBuffer, {
                metadata: { contentType: mimeType },
                public: true, // Make the file publicly accessible
            });
            
            // Get the public URL of the uploaded image
            finalPhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
        }

        const authUpdatePayload: any = {};
        if (restData.fullName) authUpdatePayload.displayName = restData.fullName;
        if (restData.email) authUpdatePayload.email = restData.email;
        if (finalPhotoUrl) authUpdatePayload.photoURL = finalPhotoUrl;

        if (Object.keys(authUpdatePayload).length > 0) {
            await adminAuth.updateUser(uid, authUpdatePayload);
        }
        
        const profileRef = adminDb.collection('clients').doc(uid);
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
