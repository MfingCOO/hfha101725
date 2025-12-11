'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { getCalendarDataForDay } from '@/app/calendar/actions';

export async function calculateDailySummaryForUser(userId: string, date: string, userTimezone: string, timezoneOffset: number): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await getCalendarDataForDay(userId, date, userTimezone, timezoneOffset);

        if (!result.success || !result.data) {
            return { success: false, error: "Failed to fetch raw data for summary calculation." };
        }
        const entries = result.data;

        let totalDayCalories = 0;
        let totalUpfCalories = 0; 
        let totalHydration = 0;
        let totalSleep = 0;
        let totalActivity = 0;
        const dailyNutrients: { [key: string]: { value: number, unit: string } } = {};

        for (const entry of entries) {
            switch (entry.pillar) {
                case 'nutrition':
                    if (entry.summary) {
                        totalDayCalories += entry.summary.totalMealCalories || 0;
                        totalUpfCalories += entry.summary.totalMealUpfCalories || 0;

                        if (entry.summary.allNutrients) {
                            for (const key in entry.summary.allNutrients) {
                                const nutrient = entry.summary.allNutrients[key];
                                if (nutrient && typeof nutrient.value === 'number') {
                                    if (!dailyNutrients[key]) {
                                        dailyNutrients[key] = { value: 0, unit: nutrient.unit || 'g' };
                                    }
                                    dailyNutrients[key].value += nutrient.value;
                                }
                            }
                        }
                    }
                    break;
                case 'hydration':
                    totalHydration += entry.amount || 0;
                    break;
                case 'sleep':
                    if (!entry.isNap) {
                        totalSleep += entry.duration || 0;
                    }
                    break;
                case 'activity':
                    totalActivity += entry.duration || 0;
                    break;
                default:
                    break;
            }
        }
        
        const finalUpfPercentage = totalDayCalories > 0 ? (totalUpfCalories / totalDayCalories) * 100 : 0;

        const dailySummary = {
            calories: Math.round(totalDayCalories),
            hydration: totalHydration,
            sleep: totalSleep,
            activity: totalActivity,
            upf: Math.round(finalUpfPercentage),
            allNutrients: dailyNutrients,
            lastCalculated: new Date().toISOString()
        };

        const summaryDocRef = adminDb.collection('clients').doc(userId).collection('dailySummaries').doc(date);
        await summaryDocRef.set(dailySummary, { merge: true });

        return { success: true };

    } catch (error: any) {
        console.error(`[SummaryCalc] CRITICAL ERROR for user ${userId} on date ${date}:`, error);
        return { success: false, error: error.message };
    }
}