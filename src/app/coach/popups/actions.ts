'use server';

import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { auth } from 'firebase-admin';
import { uploadImageAction } from '../actions'; 
import { ActionResponse } from '@/types/action-response';

// --- Zod Schema for Popup Validation (from CreatePopupDialog) ---
const popupSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, "Campaign name is required."),
    title: z.string().min(3, "Title is required."),
    message: z.string().min(10, "Message is required."),
    imageUrl: z.string().optional(),
    ctaText: z.string().optional(),
    ctaUrl: z.string().url().optional().or(z.literal('')),
    scheduledAt: z.date(),
    targetType: z.enum(['all', 'tier', 'user']),
    targetValue: z.string().optional(),
}).refine(data => {
    if (data.targetType === 'tier' || data.targetType === 'user') {
        return !!data.targetValue;
    }
    return true;
}, { message: "A target value is required for this target type.", path: ["targetValue"] });


// --- Type Definitions ---
type PopupFormValues = z.infer<typeof popupSchema>;

export type Popup = {
    id: string;
    name: string;
    title: string;
    message: string;
    imageUrl?: string;
    ctaText?: string;
    ctaUrl?: string;
    scheduledAt: string; // ISO string
    createdAt: string;   // ISO string
    targetType: 'all' | 'tier' | 'user';
    targetValue?: string;
    status: 'draft' | 'scheduled' | 'active' | 'ended' | 'archived';
};

// --- Helper to serialize Firestore Timestamps ---
const serializeTimestamps = (obj: any): any => {
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj.map(serializeTimestamps);
    if (obj instanceof Timestamp) return obj.toDate().toISOString();
    if (typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, val]) => {
        acc[key] = serializeTimestamps(val);
        return acc;
      }, {} as { [key: string]: any });
    }
    return obj;
};


// --- Server Action to Save/Update a Popup (Restored for Coach Panel) ---
export async function savePopupAction(data: PopupFormValues): Promise<{ success: boolean; error?: string; popupId?: string; }> {
    try {
        const validation = popupSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors.map(e => e.message).join(', '));
        }

        const { id, ...restOfData } = validation.data;
        const popupToSave = {
            ...restOfData,
            scheduledAt: Timestamp.fromDate(restOfData.scheduledAt),
        };

        let docRef;
        if (id) {
            docRef = adminDb.collection('popups').doc(id);
            await docRef.update({ ...popupToSave, updatedAt: FieldValue.serverTimestamp() });
        } else {
            docRef = await adminDb.collection('popups').add({ ...popupToSave, status: 'scheduled', createdAt: FieldValue.serverTimestamp() });
        }

        revalidatePath('/coach/popups');
        return { success: true, popupId: docRef.id };
    } catch (error: any) {
        console.error("Error saving pop-up:", error);
        return { success: false, error: error.message };
    }
}


// --- Server Action for Coach to get all popups ---
export async function getPopupsForCoach(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        const popupsSnapshot = await adminDb.collection('popups').orderBy('scheduledAt', 'desc').get();
        const popups = popupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const serializableData = popups.map(serializeTimestamps);
        return { success: true, data: serializableData };
    } catch (error: any) {
        console.error("Error fetching pop-ups for coach:", error);
        return { success: false, error: error.message };
    }
}

// --- Server Action for CLIENT to get active, unread popups ---
export async function getActiveStickyPopupsAction(): Promise<ActionResponse<any[]>> {
    try {
        const user = auth().currentUser;
        if (!user) {
            // This is not an error, just means no user is logged in.
            return { success: true, data: [] };
        }
        
        const clientDoc = await adminDb.collection('clients').doc(user.uid).get();
        if (!clientDoc.exists) {
             return { success: false, error: 'Client profile not found.' };
        }
        const clientData = clientDoc.data()!;
        const readPopupIds = clientData.readPopupIds || [];

        const now = Timestamp.now();
        const popupsQuery = adminDb.collection('popups')
            .where('status', '==', 'active')
            .where('scheduledAt', '<=', now);
        
        const querySnapshot = await popupsQuery.get();
        if (querySnapshot.empty) {
            return { success: true, data: [] };
        }

        const allActivePopups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const filteredPopups = allActivePopups.filter(popup => {
            if (readPopupIds.includes(popup.id)) return false;

            const targetType = popup.targetType || 'all';
            if (targetType === 'all') return true;
            if (targetType === 'tier' && clientData.tier === popup.targetValue) return true;
            if (targetType === 'user' && clientData.uid === popup.targetValue) return true;

            return false;
        });

        const serializableData = serializeTimestamps(filteredPopups);
        return { success: true, data: serializableData };

    } catch (error: any) {
        console.error("Error fetching active sticky pop-ups:", error);
        return { success: false, error: "Could not fetch pop-ups." };
    }
}

// --- Server Action for CLIENT to mark a popup as read ---
export async function markPopupAsReadAction(popupId: string): Promise<ActionResponse<{}>> {
    try {
        const user = auth().currentUser;
        if (!user) {
            return { success: false, error: "User not authenticated." };
        }

        if (!popupId) {
            throw new Error("Popup ID is required.");
        }

        const userDocRef = adminDb.collection('clients').doc(user.uid);
        await userDocRef.update({
            readPopupIds: FieldValue.arrayUnion(popupId)
        });

        return { success: true, data: {} };

    } catch (error: any) {
        console.error("Error marking popup as read:", error);
        return { success: false, error: "Could not mark popup as read." };
    }
}

// --- Server Action to Delete a Popup (Restored for Coach Panel) ---
export async function deletePopupAction(popupId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!popupId) {
            throw new Error("No popup ID provided for deletion.");
        }
        await adminDb.collection('popups').doc(popupId).delete();
        revalidatePath('/coach/popups');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting popup:", error);
        return { success: false, error: error.message };
    }
}
