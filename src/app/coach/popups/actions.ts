'use server';

import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { db as adminDb } from '@/lib/firebaseAdmin';

const popupSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, "Campaign name is required."),
    title: z.string().min(3, "Title is required."),
    message: z.string().min(10, "Message is required."),
    imageUrl: z.string().url().optional().or(z.literal('')),
    ctaText: z.string().min(2, "Button text is required."),
    ctaUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
    scheduledAt: z.date(),
    targetType: z.enum(['all', 'tier', 'user']),
    targetValue: z.string().optional(),
}).refine(data => {
    if (data.targetType === 'tier' || data.targetType === 'user') return !!data.targetValue;
    return true;
}, { message: "A target value is required for this target type.", path: ["targetValue"] });

type PopupFormValues = z.infer<typeof popupSchema>;

export async function savePopupAction(data: PopupFormValues): Promise<{ success: boolean; error?: string; campaignId?: string; }> {
    try {
        const validation = popupSchema.safeParse(data);
        if (!validation.success) {
            throw new Error(validation.error.errors.map(e => e.message).join(', '));
        }

        const { id, ...validatedData } = validation.data;
        const now = FieldValue.serverTimestamp();

        let docRef;
        if (id) {
            docRef = adminDb.collection('popups').doc(id);
            await docRef.update({
                ...validatedData,
                scheduledAt: Timestamp.fromDate(validatedData.scheduledAt),
                updatedAt: now,
            });
        } else {
            docRef = await adminDb.collection('popups').add({
                ...validatedData,
                scheduledAt: Timestamp.fromDate(validatedData.scheduledAt),
                createdAt: now,
                updatedAt: now,
                status: 'scheduled', // Initial status
            });
        }

        revalidatePath('/coach/popups');
        return { success: true, campaignId: docRef.id };

    } catch (error: any) {
        console.error("Error saving pop-up campaign:", error);
        return { success: false, error: error.message };
    }
}

// This function is no longer needed as popups are now stored centrally and dispatched by a Cloud Function.
// Keeping it commented out for now in case there's a need to revert parts or for reference.
/*
async function getTargetUserIds(targetType: string, targetValue?: string): Promise<string[]> {
    const usersRef = adminDb.collection('clients');
    let querySnapshot;

    switch (targetType) {
        case 'all':
            querySnapshot = await usersRef.get();
            break;
        case 'tier':
            if (!targetValue) return [];
            querySnapshot = await usersRef.where('tier', '==', targetValue).get();
            break;
        case 'user':
            if (!targetValue) return [];
            return [targetValue]; 
        default:
            return [];
    }

    return querySnapshot.docs.map(doc => doc.id);
}
*/

export async function getPopupsForCoach(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        const popupsSnapshot = await adminDb.collection('popups').orderBy('createdAt', 'desc').get();
        const popupsList = popupsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                title: data.title,
                message: data.message,
                ctaText: data.ctaText,
                ctaUrl: data.ctaUrl || '', // Ensure ctaUrl is retrieved
                imageUrl: data.imageUrl || '',
                // Safely convert Timestamps, providing a fallback for potentially missing fields
                scheduledAt: data.scheduledAt?.toDate().toISOString() ?? new Date(0).toISOString(), // Fallback to epoch start if missing
                createdAt: data.createdAt?.toDate().toISOString() ?? new Date(0).toISOString(),   // Fallback to epoch start if missing
                updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date(0).toISOString(),   // Fallback to epoch start if missing
                targetType: data.targetType,
                targetValue: data.targetValue || null,
                status: data.status,
            };
        });

        return { success: true, data: popupsList };

    } catch (error: any) {
        console.error("Error fetching pop-up campaigns for coach:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePopupAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!campaignId) throw new Error("No campaign ID provided for deletion.");

        await adminDb.collection('popups').doc(campaignId).delete();

        revalidatePath('/coach/popups');
        return { success: true };

    } catch (error: any) {
        console.error(`Error deleting campaign ${campaignId}:`, error);
        return { success: false, error: error.message };
    }
}
