'use server';

import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

function serializeTimestamps(data: any): any {
    if (data === null || data === undefined) return data;
    if (data instanceof Timestamp) return data.toDate().toISOString();
    if (Array.isArray(data)) return data.map(serializeTimestamps);
    if (typeof data === 'object' && Object.prototype.toString.call(data) === '[object Object]') {
        const newObject: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObject[key] = serializeTimestamps(data[key]);
            }
        }
        return newObject;
    }
    return data;
}

// FINAL COMBINED SOLUTION: Based on user's working file to fix stats and search.
export async function getAllAppUsers(coachId: string, searchTerm: string = '', tierFilter: string = 'all'): Promise<{ success: boolean; clients?: ClientProfile[]; error?: string }> {
    try {
        let query: FirebaseFirestore.Query = adminDb.collection('clients');

        // Apply tier filter at the database level.
        if (tierFilter !== 'all') {
            query = query.where('tier', '==', tierFilter);
        }

        // **THE FIX**: Get all docs without ordering, to prevent users from being filtered out.
        const clientsSnapshot = await query.get();

        // **THE FIX**: Map the data correctly, preserving all stat fields.
        let clients = clientsSnapshot.docs.map(doc => serializeTimestamps({ uid: doc.id, ...doc.data() })) as ClientProfile[];

        // Perform a fast, case-insensitive search in-memory for name AND email.
        if (searchTerm) {
            const lowerCaseTerm = searchTerm.toLowerCase();
            clients = clients.filter(client => 
                (client.fullName && client.fullName.toLowerCase().includes(lowerCaseTerm)) || 
                (client.email && client.email.toLowerCase().includes(lowerCaseTerm))
            );
        }
        
        // Sort the final results in-memory after filtering.
        clients.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

        // Return the final, correct data.
        return { success: true, clients: clients };

    } catch (error: any) {
        console.error("BACKEND ERROR:", error.message);
        return { success: false, error: `An unexpected server error occurred: ${error.message}` };
    }
}
