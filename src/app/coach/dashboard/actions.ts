'use server';

import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import type { ClientProfile, Chat } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

// Helper function to serialize Firestore Timestamps
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

// RESTORED AND REPAIRED FUNCTION
// This function was deleted, breaking multiple components. It is now restored.
export async function getClientsForCoach(coachId: string): Promise<{ success: boolean; clients?: ClientProfile[]; error?: string }> {
    if (!coachId) {
        return { success: false, error: 'Coach ID is required.' };
    }
    try {
        const clientsRef = adminDb.collection('clients').where('coachId', '==', coachId);
        const clientsSnapshot = await clientsRef.get();
        const clients = clientsSnapshot.docs.map(doc => serializeTimestamps({ uid: doc.id, ...doc.data() })) as ClientProfile[];
        return { success: true, clients: clients };
    } catch (error: any) {
        console.error("Error fetching clients for coach:", error);
        return { success: false, error: error.message };
    }
}

export async function getCoachDashboardData(coachId: string) {
    try {
        const clientsRef = adminDb.collection('clients').where('coachId', '==', coachId);
        const clientsSnapshot = await clientsRef.get();
        const clients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        const chatsRef = adminDb.collection('chats').where('participants', 'array-contains', coachId);
        const chatsSnapshot = await chatsRef.get();
        const chats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const serializableData = serializeTimestamps({ clients, chats });

        return {
            success: true,
            data: serializableData,
        };
    } catch (error: any) {
        console.error("Error fetching coach dashboard data:", error);
        return { success: false, error: { message: error.message } };
    }
}

export async function getChatsAndClientsForCoach(coachId: string) {
    if (!coachId) {
        return { success: false, error: { message: 'Authentication required: Coach ID is missing.' } };
    }

    try {
        const clientsQuery = adminDb.collection('clients').where('coachId', '==', coachId);
        const clientsSnapshot = await clientsQuery.get();
        const clients = clientsSnapshot.docs.map(doc => serializeTimestamps({ id: doc.id, ...doc.data() }));

        const chatsQuery = adminDb.collection('chats').where('participants', 'array-contains', coachId).orderBy('lastCoachMessage', 'desc');
        const chatsSnapshot = await chatsQuery.get();
        const chats = chatsSnapshot.docs.map(doc => serializeTimestamps({ id: doc.id, ...doc.data() }));

        return { 
            success: true, 
            data: { 
                chats: chats as Chat[], 
                clients: clients as ClientProfile[] 
            } 
        };

    } catch (error: any) {
        console.error("Error in getChatsAndClientsForCoach:", error);
        return { success: false, error: { message: error.message } };
    }
}
