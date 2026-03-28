'use server';

import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { createUserNotification } from '@/services/reminders'; // ADDED

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

        const { name, targetType, targetValue, ctaText, ctaUrl, imageUrl, ...popupData } = validation.data;
        const campaignId = data.id || adminDb.collection('temp').doc().id; // Generate ID if not present

        const targetUserIds = await getTargetUserIds(targetType, targetValue);
        if (targetUserIds.length === 0) {
            return { success: false, error: "No clients found for the selected target." };
        }

        // MODIFIED: Replace batch write with calls to createUserNotification
        const promises = targetUserIds.map(userId => 
            createUserNotification(userId, {
                type: 'custom-popup',
                title: popupData.title,
                message: popupData.message,
                pillarId: 'megaphone', // Assuming 'megaphone' as pillar for popups
                deliverAt: Timestamp.fromDate(popupData.scheduledAt),
                entityId: campaignId, // Use campaignId as entityId
                url: ctaUrl || '',
                data: { // Original data from popupSchema might be useful for frontend or debugging
                    id: campaignId,
                    imageUrl: imageUrl || '',
                    ctaText: ctaText,
                    ctaUrl: ctaUrl || '',
                    campaignName: name,
                    targetType: targetType,
                    targetValue: targetValue || null,
                },
                isCoach: String(false), // Assuming custom popups are generally client-facing
                appointmentStartTimeMillis: undefined, // Not relevant for popups
            })
        );

        await Promise.all(promises);

        revalidatePath('/coach/popups');
        return { success: true, campaignId };

    } catch (error: any) {
        console.error("Error saving pop-up campaign:", error);
        return { success: false, error: error.message };
    }
}

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

export async function getPopupsForCoach(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        // MODIFIED: Fetch from client notifications where type is 'custom-popup' and pillarId is 'megaphone'
        // This assumes createUserNotification stored it under this structure.
        const allClientsSnapshot = await adminDb.collection('clients').get();
        const allPopups: any[] = [];

        for (const clientDoc of allClientsSnapshot.docs) {
            const userId = clientDoc.id;
            const popupNotificationsSnapshot = await adminDb.collection(`clients/${userId}/notifications`)
                .where('type', '==', 'custom-popup')
                .where('pillarId', '==', 'megaphone')
                .orderBy('createdAt', 'desc')
                .get();
            
            popupNotificationsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                // Reconstruct the original popup campaign structure for display
                // Assuming the data field in the reminder contains the original popup data
                if (data.data && data.data.campaignName) {
                    allPopups.push({
                        id: data.entityId, // entityId stores campaignId
                        name: data.data.campaignName,
                        title: data.title,
                        message: data.message,
                        ctaText: data.data.ctaText,
                        ctaUrl: data.data.ctaUrl,
                        imageUrl: data.data.imageUrl,
                        scheduledAt: (data.deliverAt as Timestamp).toDate().toISOString(),
                        status: data.status || 'sent', // Assuming it's sent if fetched from notifications
                        targetType: data.data.targetType,
                        targetValue: data.data.targetValue,
                        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                    });
                }
            });
        }

        // Deduplicate by campaignId, taking the latest scheduledAt if multiple entries exist for the same campaign
        const uniqueCampaignsMap = new Map<string, any>();
        for (const popup of allPopups) {
            if (!uniqueCampaignsMap.has(popup.id) || new Date(popup.scheduledAt) > new Date(uniqueCampaignsMap.get(popup.id).scheduledAt)) {
                uniqueCampaignsMap.set(popup.id, popup);
            }
        }

        const campaignList = Array.from(uniqueCampaignsMap.values());
        return { success: true, data: campaignList };

    } catch (error: any) {
        console.error("Error fetching pop-up campaigns for coach:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePopupAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!campaignId) throw new Error("No campaign ID provided for deletion.");

        // MODIFIED: Delete from client notifications where entityId is campaignId and type is 'custom-popup'
        const allClientsSnapshot = await adminDb.collection('clients').get();
        const deletePromises: Promise<any>[] = [];

        for (const clientDoc of allClientsSnapshot.docs) {
            const userId = clientDoc.id;
            const messagesToDeleteSnapshot = await adminDb.collection(`clients/${userId}/notifications`)
                .where('entityId', '==', campaignId)
                .where('type', '==', 'custom-popup')
                .get();
            
            messagesToDeleteSnapshot.docs.forEach(doc => {
                deletePromises.push(adminDb.collection(`clients/${userId}/notifications`).doc(doc.id).delete());
            });
        }
        
        await Promise.all(deletePromises);

        revalidatePath('/coach/popups');
        return { success: true };

    } catch (error: any) {
        console.error(`Error deleting campaign ${campaignId}:`, error);
        return { success: false, error: error.message };
    }
}
