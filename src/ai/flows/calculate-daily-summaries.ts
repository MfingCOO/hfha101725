'use server';

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { getAllDataForPeriod } from '@/services/firestore';
import { format } from 'date-fns';
import type { ClientProfile, DailySummary } from '@/types/index';
import { sanitizeForFirestore } from '@/utils/data-sanitizer';

// Initialize Genkit 1.x instance
const ai = genkit({
  plugins: [googleAI()],
});

interface ClientLog {
    entryDate: any;
    pillar: string;
    type?: string;
    duration?: number;
    isNap?: boolean;
    amount?: number;
    calories?: number;
    upf?: number;
}

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

export const calculateDailySummariesFlow = ai.defineFlow(
  {
    name: 'calculateDailySummariesFlow',
    inputSchema: CalculateSummariesInputSchema,
    outputSchema: CalculateSummariesOutputSchema,
  },
  async ({ clientId, dryRun }) => {
    console.log(`Starting daily summary calculation for client: ${clientId}`);
    const clientRef = adminDb.collection('clients').doc(clientId);
    
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) throw new Error(`Client ${clientId} not found.`);
    const clientData = clientSnap.data() as ClientProfile;

    const result = await getAllDataForPeriod(7, clientId);
    if (!result.success || !result.data) throw new Error(`Failed to fetch 7-day data for client ${clientId}.`);
    
    const dailyData = new Map<string, any>();
    let totalStressEvents = 0;
    let totalCravings = 0;
    let totalBinges = 0;

    for (const log of result.data as ClientLog[]) {
        const entryDate = safeToDate(log.entryDate);
        if (!entryDate) continue;
        const date = format(entryDate, 'yyyy-MM-dd');

        if (!dailyData.has(date)) {
            dailyData.set(date, {
                calories: 0, upf: 0, hydration: 0, sleep: 0, activity: 0,
                hasData: new Set<string>()
            });
        }
        const day = dailyData.get(date);

        switch (log.pillar) {
            case 'dailySummaries':
                if (typeof log.calories === 'number') {
                    day.calories = log.calories;
                    day.hasData.add('calories');
                }
                if (typeof log.upf === 'number') {
                    day.upf = log.upf;
                    day.hasData.add('upf');
                }
                break;
            case 'hydration':
                if (typeof log.amount === 'number') { day.hydration += log.amount; day.hasData.add('hydration'); }
                break;
            case 'sleep':
                if (typeof log.duration === 'number' && !log.isNap) { day.sleep += log.duration; day.hasData.add('sleep'); }
                break;
            case 'activity':
                if (typeof log.duration === 'number') { day.activity += log.duration; day.hasData.add('activity'); }
                break;
            case 'stress':
                if (log.type === 'event') totalStressEvents++;
                break;
            case 'cravings':
                if (log.type === 'craving') totalCravings++;
                if (log.type === 'binge') totalBinges++;
                break;
        }
    }

    let sumCalories = 0, calorieDays = 0;
    let sumUpf = 0, upfDays = 0;
    let sumHydration = 0, hydrationDays = 0;
    let sumSleep = 0, sleepDays = 0;
    let sumActivity = 0, activityDays = 0;

    for (const day of dailyData.values()) {
        if (day.hasData.has('calories') && day.calories > 0) { sumCalories += day.calories; calorieDays++; }
        if (day.hasData.has('upf')) { sumUpf += day.upf; upfDays++; }
        if (day.hasData.has('hydration')) { sumHydration += day.hydration; hydrationDays++; }
        if (day.hasData.has('sleep')) { sumSleep += day.sleep; sleepDays++; }
        if (day.hasData.has('activity')) { sumActivity += day.activity; activityDays++; }
    }

    const avgCalories = calorieDays > 0 ? sumCalories / calorieDays : 0;
    const avgUpfPercent = upfDays > 0 ? sumUpf / upfDays : 0;
    const avgHydration = hydrationDays > 0 ? sumHydration / hydrationDays : 0;
    const avgSleep = sleepDays > 0 ? sumSleep / sleepDays : 0;
    const avgActivity = activityDays > 0 ? sumActivity / activityDays : 0;
    
    const measurementsQuery = await clientRef.collection('measurements').orderBy('entryDate', 'asc').get();
    const weightData = measurementsQuery.docs.map(d => { 
        const data = d.data(); 
        const date = safeToDate(data.entryDate); 
        return date ? { weight: data.weight, date } : null; 
    }).filter((d): d is { weight: number; date: Date } => d !== null && d.weight !== null);
    
    const waistData = measurementsQuery.docs.map(d => { 
        const data = d.data(); 
        const date = safeToDate(data.entryDate); 
        return date ? { waist: data.waist, date } : null; 
    }).filter((d): d is { waist: number; date: Date } => d !== null && d.waist !== null);
    
    const firstWeightEntry = weightData[0] || null;
    const lastWeightEntry = weightData[weightData.length - 1] || null;
    const lastWaistEntry = waistData[waistData.length - 1] || null;
    
    const height = clientData.onboarding?.height;
    const latestWaist = lastWaistEntry?.waist || clientData.onboarding?.waist;
    const currentWthr: number | null = (height && latestWaist) ? (latestWaist / height) : null;

    const birthdate = safeToDate(clientData.onboarding?.birthdate);
    const dob: string | null = birthdate ? format(birthdate, 'MM/dd/yy') : null;

    const summary: DailySummary = {
        lastUpdated: Timestamp.now(),
        dob: dob,
        // Now valid since we updated types/index.ts
        sex: clientData.onboarding?.sex || null,
        unit: clientData.onboarding?.units === 'metric' ? 'kg' : 'lbs',
        startWeight: firstWeightEntry?.weight || null,
        currentWeight: lastWeightEntry?.weight || null,
        lastWeightDate: lastWeightEntry ? lastWeightEntry.date.toISOString().slice(0, 10) : null,
        startWthr: clientData.wthr || null,
        currentWthr: currentWthr,
        lastWaistDate: lastWaistEntry ? lastWaistEntry.date.toISOString().slice(0, 10) : null,
        avgSleep: avgSleep,
        avgActivity: avgActivity,
        avgHydration: avgHydration,
        cravings: totalCravings,
        binges: totalBinges,
        stressEvents: totalStressEvents,
        avgUpf: avgUpfPercent,
        avgNutrients: {
            Energy: avgCalories,
        },
    };

    if (!dryRun) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const sanitizedSummary = sanitizeForFirestore(summary);
        await clientRef.update({ 
            [`dailySummaries.${today}`]: sanitizedSummary,
            'wthr': currentWthr,
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
    // In Genkit 1.x, flows are directly executable. 
    // No need for ai.run or runFlow.
    return await calculateDailySummariesFlow(input);
}