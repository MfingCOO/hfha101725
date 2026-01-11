'use server';
/**
 * @fileOverview This flow calculates a 7-day rolling summary of key metrics for a client.
 * It is designed to be triggered after a new data entry is logged.
 */

import { defineFlow, runFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { getAllDataForPeriod } from '@/services/firestore';
import { differenceInCalendarDays, subDays, isWithinInterval, format } from 'date-fns';
import type { ClientProfile } from '@/types/index';

const CalculateSummariesInputSchema = z.object({
  clientId: z.string().describe('The UID of the client to process.'),
  dryRun: z.boolean().optional().default(false),
});

type CalculateSummariesInput = z.infer<typeof CalculateSummariesInputSchema>;

const CalculateSummariesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

type CalculateSummariesOutput = z.infer<typeof CalculateSummariesOutputSchema>;

const safeToDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch (e) {
        return null;
    }
};

const calculateDailySummariesFlow = defineFlow(
  {
    name: 'calculateDailySummariesFlow',
    inputSchema: CalculateSummariesInputSchema,
    outputSchema: CalculateSummariesOutputSchema,
  },
  async ({ clientId, dryRun }) => {
    console.log(`Starting daily summary calculation for client: ${clientId}`);
    const clientRef = adminDb.collection('clients').doc(clientId);
    
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) {
        throw new Error(`Client ${clientId} not found.`);
    }
    const clientData = clientSnap.data() as ClientProfile;

    const result = await getAllDataForPeriod(7, clientId);
    if (!result.success || !result.data) {
        throw new Error(`Failed to fetch 7-day data for client ${clientId}.`);
    }
    const entries = result.data;
    
    const now = new Date();
    const twentyFourHoursAgo = subDays(now, 1);

    let totalSleepHours = 0;
    let sleepDays = 0;
    let totalActivityMinutes = 0;
    let totalHydrationOz = 0;
    let hydrationDays = 0;
    let cravings = 0;
    let binges = 0;
    let stressEvents = 0;
    let totalUpfScore = 0;
    let upfMeals = 0;
    let recentBingeDetected = false;
    let mostRecentBingeTimestamp: Timestamp | null = null;
    const nutrientTotals: Record<string, number> = {};

    for (const entry of entries) {
        if (!entry.pillar) continue;

        const entryDate = safeToDate(entry.entryDate);
        if (!entryDate) continue;

        if (entry.pillar === 'cravings') {
            if (entry.type === 'binge') {
                binges++;
                if (isWithinInterval(entryDate, { start: twentyFourHoursAgo, end: now })) {
                    recentBingeDetected = true;
                    const bingeTimestamp = Timestamp.fromDate(entryDate);
                    if (!mostRecentBingeTimestamp || bingeTimestamp.toMillis() > mostRecentBingeTimestamp.toMillis()) {
                         mostRecentBingeTimestamp = bingeTimestamp;
                    }
                }
            } else if (entry.type === 'craving') {
                cravings++;
            }
        } else if (entry.pillar === 'stress' && entry.type === 'event') {
            stressEvents++;
        }

        if (entry.pillar === 'sleep' && !entry.isNap) {
            totalSleepHours += entry.duration || 0;
            sleepDays++;
        }
        if (entry.pillar === 'activity') {
            totalActivityMinutes += entry.duration || 0;
        }
        if (entry.pillar === 'hydration') {
            totalHydrationOz += entry.amount || 0;
            hydrationDays++;
        }

        // DEFINITIVE FIX: Replicate the working logic from Data Insights.
        if (entry.pillar === 'nutrition' && entry.summary) {
            // 1. Correctly check for upfPercentage and add its value.
            if (entry.summary.upfPercentage) {
                totalUpfScore += entry.summary.upfPercentage.value || 0;
                upfMeals++;
            }
            
            // 2. Correctly aggregate nutrients for calorie calculation.
            if (entry.summary.nutrients) {
                for (const key in entry.summary.nutrients) {
                    const nutrient = entry.summary.nutrients[key];
                    if(nutrient && typeof nutrient.value === 'number') {
                      nutrientTotals[key] = (nutrientTotals[key] || 0) + nutrient.value;
                    }
                }
            }
        }
    }
    
    const measurementsQuery = await clientRef.collection('measurements')
        .orderBy('entryDate', 'asc')
        .get();
        
    const weightData = measurementsQuery.docs.map(d => {
        const data = d.data();
        const date = safeToDate(data.entryDate);
        return date ? { weight: data.weight, date } : null;
    }).filter(d => d && d.weight);

    const waistData = measurementsQuery.docs.map(d => {
        const data = d.data();
        const date = safeToDate(data.entryDate);
        return date ? { waist: data.waist, date } : null;
    }).filter(d => d && d.waist);

    const age = clientData.onboarding?.birthdate ? differenceInCalendarDays(new Date(), new Date(clientData.onboarding.birthdate)) / 365.25 : 0;
    
    const summary = {
        lastUpdated: Timestamp.now(),
        age: Math.floor(age),
        sex: clientData.onboarding?.sex || 'unspecified',
        unit: clientData.onboarding?.units === 'metric' ? 'kg' : 'lbs',
        startWeight: weightData.length > 0 ? weightData[0].weight : null,
        currentWeight: weightData.length > 0 ? weightData[weightData.length - 1].weight : null,
        lastWeightDate: weightData.length > 0 ? weightData[weightData.length - 1].date.toISOString() : null,
        startWthr: clientData.wthr,
        currentWthr: clientData.wthr,
        lastWaistDate: waistData.length > 0 ? waistData[waistData.length - 1].date.toISOString() : null,
        avgSleep: sleepDays > 0 ? totalSleepHours / sleepDays : 0,
        avgActivity: totalActivityMinutes / 7,
        avgHydration: hydrationDays > 0 ? totalHydrationOz / hydrationDays : 0,
        cravings,
        binges,
        stressEvents,
        avgUpf: upfMeals > 0 ? totalUpfScore / upfMeals : 0,
        avgNutrients: {
            Energy: (nutrientTotals['Energy'] || 0) / 7,
            Protein: (nutrientTotals['Protein'] || 0) / 7,
            'Total lipid (fat)': (nutrientTotals['Total lipid (fat)'] || 0) / 7,
            'Carbohydrate, by difference': (nutrientTotals['Carbohydrate, by difference'] || 0) / 7,
        },
    };

    if (!dryRun) {
        const today = format(new Date(), 'yyyy-MM-dd');
        await clientRef.update({ 
            [`dailySummaries.${today}`]: summary 
        });
        console.log(`Successfully updated daily summary for client: ${clientId}`);
    }

    return {
      success: true,
      message: `Summary calculated for client ${clientId}. ${dryRun ? '[DRY RUN]' : ''}`,
    };
  }
);

export async function calculateDailySummaries(input: CalculateSummariesInput): Promise<CalculateSummariesOutput> {
    return await runFlow(calculateDailySummariesFlow, input);
}
