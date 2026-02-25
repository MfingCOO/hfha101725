'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { subHours } from 'date-fns';

export async function getStressAndHungerSpotlight(userId: string): Promise<{
    success: boolean;
    data?: { icon: string; title: string; message: string; } | null;
    error?: string;
}> {
    if (!userId) return { success: false, error: "User ID is required." };

    try {
        const now = new Date();
        const twentyFourHoursAgo = subHours(now, 24);
        const startTimestamp = Timestamp.fromDate(twentyFourHoursAgo);

        const cravingsPromise = adminDb.collection(`clients/${userId}/cravings`)
            .where('entryDate', '>=', startTimestamp).get();
        const stressPromise = adminDb.collection(`clients/${userId}/stress`)
            .where('type', '==', 'event')
            .where('entryDate', '>=', startTimestamp).get();
        
        const [cravingsSnapshot, stressSnapshot] = await Promise.all([cravingsPromise, stressPromise]);

        const cravings = cravingsSnapshot.docs.map(doc => doc.data());
        const stressEvents = stressSnapshot.docs.map(doc => doc.data());

        // --- Algorithmic Analysis ---
        const bingeEvents = cravings.filter(c => c.type === 'binge');
        if (bingeEvents.length > 0) {
            return {
                success: true,
                data: {
                    icon: 'HeartCrack',
                    title: 'Recent Binge Logged',
                    message: `A binge was logged in the last 24 hours. Take a moment for self-compassion and reflect on the potential triggers.`
                }
            };
        }

        const highStressEvents = stressEvents.filter(s => s.stressLevel >= 7);
        if (highStressEvents.length >= 2) {
            return {
                success: true,
                data: {
                    icon: 'ShieldAlert',
                    title: 'High Stress Pattern',
                    message: `You\'ve logged multiple high-stress events recently. Remember to use your stress relief tools to prevent them from turning into cravings.`
                }
            };
        }

        const highHungerCravings = cravings.filter(c => c.hunger >= 7);
        if (highHungerCravings.length > 0) {
             return {
                success: true,
                data: {
                    icon: 'Apple',
                    title: 'Hunger & Cravings',
                    message: `A craving was logged when hunger was high. Ensure you\'re eating enough protein and fiber in your main meals to promote satiety.`
                }
            };
        }

        // If no significant negative patterns, return a positive reinforcement.
        return {
            success: true,
            data: {
                icon: 'Zap',
                title: 'Steady & Strong',
                message: 'No major stress or craving events were logged in the last 24 hours. Great job staying balanced and in control!'
            }
        };

    } catch (error: any) {
        console.error('Error getting stress and hunger spotlight:', error);
        return { success: false, error: error.message };
    }
}
