'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';

/**
 * Fetches the global site settings, including AI model configuration.
 * This function is used by AI flows and should be isolated.
 * Uses the Admin SDK to bypass security rules.
 */
export async function getSiteSettingsAction(): Promise<{ success: boolean; data?: any; error?: any; }> {
    try {
        const docRef = adminDb.collection('siteSettings').doc('v1');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            return { success: true, data: data };
        }
        
        return { success: true, data: {} }; 
        
    } catch (error: any) {
        console.error("Error fetching site settings (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}
