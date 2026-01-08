'use server';

import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { db as adminDb } from '@/lib/firebaseAdmin';

const popupSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, "Campaign name is required."),
    title: z.string().min(3, "Title is required."),
    message: z.string().min(10, "Message is required."),
    imageUrl: z.string().optional(),
    ctaText: z.string().min(2, "Button text is required."),
    ctaUrl: z.string().url().optional().or(z.literal('')),
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

        const { name, targetType, targetValue, ctaText, imageUrl, ...popupData } = validation.data;
        const campaignId = data.id || adminDb.collection('temp').doc().id;

        const targetUserIds = await getTargetUserIds(targetType, targetValue);
        if (targetUserIds.length === 0) {
            return { success: false, error: "No clients found for the selected target." };
        }

        const batch = adminDb.batch();
        for (const userId of targetUserIds) {
            const messageRef = adminDb.collection('user_scheduled_reminders').doc(); 
            batch.set(messageRef, {
                userId,
                type: 'coach_popup',
                title: popupData.title,
                message: popupData.message,
                ctaUrl: popupData.ctaUrl || '',
                ctaText: ctaText, 
                imageUrl: imageUrl || '',
                scheduledAt: Timestamp.fromDate(popupData.scheduledAt),
                status: 'scheduled',
                isRecurring: false,
                createdAt: Timestamp.now(),
                campaignId,
                campaignName: name, 
                // FINAL FIX: Save targeting info for debugging and future use
                targetType: targetType,
                targetValue: targetValue || null,
            });
        }

        await batch.commit();

        revalidatePath('/coach/popups');
        return { success: true, campaignId };

    } catch (error: any) {
        console.error("Error saving pop-up campaign:", error);
        return { success: false, error: error.message };
    }
}

async function getTargetUserIds(targetType: string, targetValue?: string): Promise<string[]> {
    // This assumes 'users' is the primary collection of all users with profiles.
    const usersRef = adminDb.collection('users');
    let querySnapshot;

    switch (targetType) {
        case 'all':
            // This should ideally target only active clients. Assuming 'users' contains them.
            querySnapshot = await usersRef.get();
            break;
        case 'tier':
            if (!targetValue) return [];
            // Assumes user documents have a 'tier' field in their profile subcollection or root.
            querySnapshot = await usersRef.where('tier', '==', targetValue).get();
            break;
        case 'user':
            if (!targetValue) return [];
            // The targetValue is the specific user's UID.
            return [targetValue]; 
        default:
            return [];
    }

    // Return the document ID, which is the user UID.
    return querySnapshot.docs.map(doc => doc.id);
}

export async function getPopupsForCoach(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        const messagesSnapshot = await adminDb.collection('user_scheduled_reminders').where('type', '==', 'coach_popup').orderBy('createdAt', 'desc').get();
        
        const campaigns = messagesSnapshot.docs.reduce((acc, doc) => {
            const data = doc.data();
            const campaignId = data.campaignId;
            if (!campaignId) return acc;

            if (!acc[campaignId]) {
                acc[campaignId] = {
                    id: campaignId,
                    name: data.campaignName,
                    title: data.title,
                    message: data.message,
                    ctaText: data.ctaText,
                    ctaUrl: data.ctaUrl,
                    imageUrl: data.imageUrl,
                    scheduledAt: (data.scheduledAt as Timestamp).toDate().toISOString(),
                    status: data.status,
                    targetType: data.targetType,
                    targetValue: data.targetValue,
                    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                };
            }
            return acc;
        }, {} as { [key: string]: any });

        const campaignList = Object.values(campaigns);
        return { success: true, data: campaignList };

    } catch (error: any) {
        console.error("Error fetching pop-up campaigns for coach:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePopupAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!campaignId) throw new Error("No campaign ID provided for deletion.");

        const messagesToDelete = await adminDb.collection('user_scheduled_reminders').where('campaignId', '==', campaignId).get();
        
        if (messagesToDelete.empty) return { success: true };

        const batch = adminDb.batch();
        messagesToDelete.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        revalidatePath('/coach/popups');
        return { success: true };

    } catch (error: any) {
        console.error(`Error deleting campaign ${campaignId}:`, error);
        return { success: false, error: error.message };
    }
}
