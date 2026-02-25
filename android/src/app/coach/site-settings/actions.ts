'use server';

import { siteSettingsSchema, type SiteSettings } from '@/schemas/siteSettings';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Fetches site settings from Firestore.
 */
export async function getSiteSettingsAction(): Promise<{ success: boolean; data?: SiteSettings; error?: string }> {
    try {
        const { db: adminDb } = await import('@/lib/firebaseAdmin');

        const serializeTimestamps = (obj: any): any => {
          if (!obj) return obj;
          if (obj instanceof Timestamp) { // <-- THE FIX
            return obj.toDate().toISOString();
          }
          if (Array.isArray(obj)) {
            return obj.map(item => serializeTimestamps(item));
          }
          if (typeof obj === 'object' && obj !== null) {
            const newObj: { [key: string]: any } = {};
            for (const key in obj) {
              newObj[key] = serializeTimestamps(obj[key]);
            }
            return newObj;
          }
          return obj;
        };

        const docRef = adminDb.collection('siteSettings').doc('v1');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const settingsData = docSnap.data() as SiteSettings;
            const serializedData = serializeTimestamps(settingsData);
            return { success: true, data: serializedData };
        } else {
            return { success: true, data: { url: '', videoCallLink: '', aiModelSettings: { pro: '', flash: '' } } };
        }
    } catch (error: any) {
        console.error("Error fetching site settings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates site settings in Firestore.
 */
export async function updateSiteSettingsAction(settings: SiteSettings): Promise<{ success: boolean; error?: string }> {
    try {
        const { db: adminDb } = await import('@/lib/firebaseAdmin');
        const validation = siteSettingsSchema.safeParse(settings);

        if (!validation.success) {
            return { success: false, error: validation.error.message };
        }

        const docRef = adminDb.collection('siteSettings').doc('v1');
        await docRef.set(validation.data, { merge: true });
        return { success: true };

    } catch (error: any) {
        console.error("Error updating site settings:", error);
        return { success: false, error: error.message };
    }
}
