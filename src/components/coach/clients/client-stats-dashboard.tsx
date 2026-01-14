'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Droplet, Bed, Utensils, Activity, AlertTriangle, ShieldCheck, Cookie, CakeSlice, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getAllDataForPeriod } from '@/services/firestore';
import type { LucideIcon } from 'lucide-react';

interface ClientStatsDashboardProps {
  client: ClientProfile;
  onDeleteClient: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

interface ClientLog {
    entryDate: string;
    pillar: string;
    type: string;
    summary?: any;
    amount?: number;
    duration?: number;
    calories?: number;
    upf?: number;
}

interface AggregatedSummaryData {
    avgCalories: { value: number; days: number };
    avgHydration: { value: number; days: number };
    avgSleep: { value: number; days: number };
    avgActivity: { value: number; days: number };
    avgUpfPercent: { value: number; days: number };
    stressEvents: number;
    stressReliefs: number;
    cravings: number;
    binges: number;
}

const StaticInfo = ({ title, value }: { title: string; value: string | number }) => (
    <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="font-bold text-sm">{value}</p>
    </div>
);

// STYLISTIC FIX: Darker card background and space for units
const DataCard = ({ icon: Icon, title, value, unit, context }: { icon: LucideIcon, title: string, value: string, unit: string, context: string }) => (
    <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-lg p-2.5 flex flex-col aspect-square justify-between shadow-md">
        <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-neutral-400 whitespace-pre-wrap">{title}</span>
            <Icon className="h-4 w-4 text-neutral-500 shrink-0" />
        </div>
        <div>
            <p className="text-xl font-bold text-white tracking-tighter">
                {value}
                {unit && <span className="text-base font-medium text-neutral-300"> {unit}</span>}
            </p>
            <p className="text-[10px] text-neutral-500 -mt-1">{context}</p>
        </div>
    </div>
);

export function ClientStatsDashboard({
  client,
  onDeleteClient,
  onRefresh,
  isRefreshing,
}: ClientStatsDashboardProps) {

  const { toast } = useToast();
  const [summary, setSummary] = useState<AggregatedSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insightPeriod = 7;

  const aggregateLogs = useCallback((logs: ClientLog[]): AggregatedSummaryData => {
        const dailyData = new Map<string, any>();
        let totalStressEvents = 0, totalStressReliefs = 0, totalCravings = 0, totalBinges = 0;

        logs.forEach(log => {
            const date = log.entryDate.split('T')[0];
            if (!dailyData.has(date)) {
                dailyData.set(date, { calories: 0, upf: 0, hydration: 0, sleep: 0, activity: 0, hasData: new Set<string>() });
            }
            const day = dailyData.get(date);

            switch (log.pillar) {
                case 'dailySummaries':
                    if (typeof log.calories === 'number') { day.calories = log.calories; day.hasData.add('calories'); }
                    if (typeof log.upf === 'number') { day.upf = log.upf; day.hasData.add('upf'); }
                    break;
                case 'hydration':
                    if (typeof log.amount === 'number') { day.hydration += log.amount; day.hasData.add('hydration'); }
                    break;
                case 'sleep':
                    if (typeof log.duration === 'number') { day.sleep += log.duration; day.hasData.add('sleep'); }
                    break;
                case 'activity':
                    if (typeof log.duration === 'number') { day.activity += log.duration; day.hasData.add('activity'); }
                    break;
                case 'stress':
                     if (log.type === 'event') totalStressEvents++;
                     if (log.type === 'relief') totalStressReliefs++;
                    break;
                case 'cravings':
                    if (log.type === 'craving') totalCravings++;
                    if (log.type === 'binge') totalBinges++;
                    break;
            }
        });

        let sumCalories = 0, calorieDays = 0, sumUpf = 0, upfDays = 0, sumHydration = 0, hydrationDays = 0, sumSleep = 0, sleepDays = 0, sumActivity = 0, activityDays = 0;

        for (const day of dailyData.values()) {
            if (day.hasData.has('calories') && day.calories > 0) { sumCalories += day.calories; calorieDays++; }
            if (day.hasData.has('upf')) { sumUpf += day.upf; upfDays++; }
            if (day.hasData.has('hydration')) { sumHydration += day.hydration; hydrationDays++; }
            if (day.hasData.has('sleep')) { sumSleep += day.sleep; sleepDays++; }
            if (day.hasData.has('activity')) { sumActivity += day.activity; activityDays++; }
        }

        return {
            avgCalories: { value: calorieDays > 0 ? sumCalories / calorieDays : 0, days: calorieDays },
            avgUpfPercent: { value: upfDays > 0 ? sumUpf / upfDays : 0, days: upfDays },
            avgHydration: { value: hydrationDays > 0 ? sumHydration / hydrationDays : 0, days: hydrationDays },
            avgSleep: { value: sleepDays > 0 ? sumSleep / sleepDays : 0, days: sleepDays },
            avgActivity: { value: activityDays > 0 ? sumActivity / activityDays : 0, days: activityDays },
            stressEvents: totalStressEvents, stressReliefs: totalStressReliefs, cravings: totalCravings, binges: totalBinges,
        };
    }, []);

    useEffect(() => {
        if (client) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const result = await getAllDataForPeriod(insightPeriod, client.uid);
                    if (result.success && result.data) {
                        const summaryData = aggregateLogs(result.data as ClientLog[]);
                        setSummary(summaryData);
                    } else {
                        throw new Error(result.error || 'Failed to fetch client data.');
                    }
                } catch (error: any) {
                    toast({ variant: 'destructive', title: 'Error Loading Stats', description: error.message });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [client, insightPeriod, aggregateLogs, toast]);

    const metricCards = useMemo(() => {
        if (!summary) return [];
        return [
            { icon: Utensils, title: "Calories", value: summary.avgCalories.value.toFixed(0), unit: "kcal", context: `${summary.avgCalories.days}/${insightPeriod}d`},
            { icon: Percent, title: "AVG. UPF", value: summary.avgUpfPercent.value.toFixed(0), unit: "%", context: `${summary.avgUpfPercent.days}/${insightPeriod}d`},
            { icon: Droplet, title: "Hydration", value: summary.avgHydration.value.toFixed(0), unit: "oz", context: `${summary.avgHydration.days}/${insightPeriod}d`},
            { icon: Bed, title: "Sleep", value: summary.avgSleep.value.toFixed(1), unit: "hrs", context: `${summary.avgSleep.days}/${insightPeriod}d`},
            { icon: Activity, title: "Activity", value: summary.avgActivity.value.toFixed(0), unit: "min", context: `${summary.avgActivity.days}/${insightPeriod}d`},
            { icon: ShieldCheck, title: "Stress Relief", value: summary.stressReliefs.toString(), unit: "", context: `last ${insightPeriod}d` },
            { icon: AlertTriangle, title: "Stress Events", value: summary.stressEvents.toString(), unit: "", context: `last ${insightPeriod}d` },
            { icon: Cookie, title: "Cravings", value: summary.cravings.toString(), unit: "", context: `last ${insightPeriod}d` },
            { icon: CakeSlice, title: "Binges", value: summary.binges.toString(), unit: "", context: `last ${insightPeriod}d` }, 
        ];
    }, [summary, insightPeriod]);
    
    const onboarding = client.onboarding;
    const durationInDays = client.createdAt ? differenceInDays(new Date(), new Date(client.createdAt as string)) : 0;
    const age = onboarding?.birthdate ? Math.floor(differenceInDays(new Date(), new Date(onboarding.birthdate)) / 365.25) : 'N/A';

    return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-lg font-bold truncate">{client.fullName}</h3>
                <p className="text-sm text-muted-foreground truncate">{client.email}</p>
            </div>
            <div className="flex-shrink-0 flex gap-2">
                <Button onClick={onRefresh} disabled={true} size="sm">{isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Refresh</Button>
                <Button onClick={onDeleteClient} variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>

        <Separator />
        
        {/* STYLISTIC FIX: Changed to 5 columns to add Sex back in */}
        <div className="grid grid-cols-5 gap-2 text-center">
            <StaticInfo title="Weight" value={`${onboarding?.weight || 'N/A'} ${onboarding?.units === 'metric' ? 'kg' : 'lbs'}`} />
            <StaticInfo title="WtHR" value={client.wthr?.toFixed(2) || 'N/A'} />
            <StaticInfo title="Age" value={age} />
            <StaticInfo title="Sex" value={onboarding?.sex ? onboarding.sex.charAt(0).toUpperCase() : 'N/A'} />
            <StaticInfo title="Duration" value={`${durationInDays}d`} />
        </div>
        
        <Separator />

        {isLoading ? (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : summary ? (
            <div className="grid grid-cols-3 gap-2.5">
                {metricCards.map(card => <DataCard key={card.title} {...card} />)}
            </div>
        ) : (
            <p className="text-center text-sm text-neutral-500 py-12">No data available for the last 7 days.</p>
        )}

      </CardContent>
    </Card>
  );
}
