
import { type SiteSettings } from '@/schemas/siteSettings';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
/**
 * Fetches site settings directly from Firestore for server-side use.
 */
export async function getSiteSettings(): Promise<{ success: boolean; data?: SiteSettings; error?: string }> {
    try {
        // Recursive function to convert all Firestore Timestamps in an object to ISO strings.
        const serializeTimestamps = (obj: any): any => {
          if (!obj) return obj;
          // IMPORTANT: Check for admin.firestore.Timestamp
          if (obj instanceof Timestamp) {
            return obj.toDate().toISOString();
          }
          if (Array.isArray(obj)) {
            return obj.map(item => serializeTimestamps(item));
          }
          if (typeof obj === 'object') {
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
            // Return default/empty settings if none are found
            return { success: true, data: { url: '', videoCallLink: '', aiModelSettings: { pro: '', flash: '' } } };
        }
    } catch (error: any) {
        console.error("Error fetching site settings directly:", error);
        return { success: false, error: error.message };
    }
}
