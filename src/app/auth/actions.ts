'use server';

import { db } from '@/lib/firebaseAdmin';
import { firestore } from 'firebase-admin';

/**
 * Recursively converts Firestore Timestamps and GeoPoints within an object to serializable formats.
 * @param obj The object or value to process.
 * @returns The processed object with special types converted.
 */
function deepConvertTimestamps(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Convert Firestore Timestamp to milliseconds
    if (typeof obj.toMillis === 'function' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
        return obj.toMillis();
    }

    // Convert Firestore GeoPoint to a plain object
    if (obj instanceof firestore.GeoPoint) {
        return { latitude: obj.latitude, longitude: obj.longitude };
    }

    // If it's an array, recursively process each item.
    if (Array.isArray(obj)) {
        return obj.map(item => deepConvertTimestamps(item));
    }

    // If it's a plain object, recursively process each value.
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = deepConvertTimestamps(obj[key]);
        }
    }
    return newObj;
}

/**
 * Fetches a user's profile and sanitizes it for client-side use.
 * This function runs on the server with admin privileges.
 * @param uid The user's ID.
 * @returns An object with success status and the serializable user profile data.
 */
export async function getUserProfileAndRole(uid: string) {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }

    try {
        const fetchAndProcess = async (collection: string, role: string) => {
            const docRef = db.collection(collection).doc(uid);
            const doc = await docRef.get();
            if (doc.exists) {
                const profile = doc.data() || {};
                profile.role = role;
                const serializableProfile = deepConvertTimestamps(profile);
                return { success: true, data: serializableProfile };
            }
            return null;
        };

        const coachResult = await fetchAndProcess('coaches', 'coach');
        if (coachResult) return coachResult;

        const clientResult = await fetchAndProcess('clients', 'client');
        if (clientResult) return clientResult;

        return { success: false, error: 'Profile not found in any collection.' };

    } catch (error: any) {
        console.error('Error in getUserProfileAndRole server action:', error);
        return { success: false, error: 'A server error occurred while fetching the user profile.' };
    }
}
