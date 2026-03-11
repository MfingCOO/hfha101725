'use server';

import { db } from '@/lib/firebaseAdmin';
import { firestore } from 'firebase-admin';

/**
 * Recursively converts Firestore Timestamps within an object to a serializable format.
 * @param obj The object or value to process.
 * @returns The processed object with Timestamps converted.
 */
function deepConvertTimestamps(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (typeof obj.toMillis === 'function' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
        return obj.toMillis();
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepConvertTimestamps(item));
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = deepConvertTimestamps(obj[key]);
        }
    }
    return newObj;
}

/**
 * Fetches a user's profile and correctly determines their role (client or coach).
 * This function runs on the server with admin privileges.
 * @param uid The user's ID.
 * @returns An object with success status and the serializable user profile data, including the correct role.
 */
export async function getUserProfileAndRole(uid: string) {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }

    try {
        // Primary check: Look for the user in the 'clients' collection.
        const clientRef = db.collection('clients').doc(uid);
        const clientDoc = await clientRef.get();

        if (clientDoc.exists) {
            const profile = clientDoc.data() || {};
            
            // **FIXED LOGIC**: Check the 'role' field within the document.
            // If the role is 'coach', assign 'coach'. Otherwise, default to 'client'.
            profile.role = profile.role === 'coach' ? 'coach' : 'client';
            
            const serializableProfile = deepConvertTimestamps(profile);
            return { success: true, data: serializableProfile };
        }

        // Legacy fallback: If not in 'clients', check the old 'coaches' collection.
        // This maintains backward compatibility.
        const coachRef = db.collection('coaches').doc(uid);
        const coachDoc = await coachRef.get();

        if (coachDoc.exists) {
            const profile = coachDoc.data() || {};
            profile.role = 'coach'; // Users from this collection are always coaches.
            const serializableProfile = deepConvertTimestamps(profile);
            return { success: true, data: serializableProfile };
        }

        return { success: false, error: 'Profile not found in any collection.' };

    } catch (error: any) {
        console.error('Error in getUserProfileAndRole server action:', error);
        return { success: false, error: 'A server error occurred while fetching the user profile.' };
    }
}
