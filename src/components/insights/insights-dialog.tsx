'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Heart, Droplet, Bed, Utensils, Activity, AlertTriangle, ShieldCheck, Cookie, CakeSlice, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '../auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { getAllDataForPeriod } from '@/services/firestore';
import { WeightTrendChartDialog } from './weight-trend-chart';
import { WthrTrendChartDialog } from './wthr-trend-chart';
import { ScrollArea } from '../ui/scroll-area';
import type { LucideIcon } from 'lucide-react';
import { useAdMob } from '@/hooks/useAdMob';

interface InsightsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Corrected interface to handle nested nutrition data from individual meal logs
interface ClientLog {
    entryDate: string;
    pillar: string;
    type: string;
    summary?: any; // Handles nested nutrition data, e.g., summary.nutrients.Energy.value
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

const DataCard = ({ icon: Icon, title, value, unit, context }: { icon: LucideIcon, title: string, value: string, unit: string, context: string }) => (
    <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-lg p-2 flex flex-col aspect-square justify-between shadow-md">
        <div>
            <div className="flex justify-between items-start">
                <span className="text-[11px] leading-tight font-medium text-neutral-400 whitespace-normal">{title}</span>
                <Icon className="h-4 w-4 text-neutral-500 shrink-0" />
            </div>
        </div>
        <div>
            <p className="text-lg font-bold text-white tracking-tighter leading-none">
                {value}
                <span className="text-xs font-medium text-neutral-300 ml-0.5">{unit}</span>
            </p>
            <p className="text-[10px] text-neutral-500">{context}</p>
        </div>
    </div>
);

export function InsightsDialog({ isOpen, onClose }: InsightsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const { prepareInterstitialAd, showInterstitialAd } = useAdMob();
    
    const [summary, setSummary] = useState<AggregatedSummaryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [insightPeriod, setInsightPeriod] = useState<number>(7);
    const [isWeightChartOpen, setIsWeightChartOpen] = useState(false);
    const [isWthrChartOpen, setIsWthrChartOpen] = useState(false);

    // Definitive logic: Calculates nutrition from raw meal logs.
    const aggregateLogs = useCallback((logs: ClientLog[]): AggregatedSummaryData => {
        const dailyData = new Map<string, any>();
        let totalStressEvents = 0;
        let totalStressReliefs = 0;
        let totalCravings = 0;
        let totalBinges = 0;

        logs.forEach(log => {
            const date = log.entryDate.split('T')[0];
            if (!dailyData.has(date)) {
                dailyData.set(date, {
                    calories: 0,
                    upf: 0,
                    hydration: 0,
                    sleep: 0,
                    activity: 0,
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
                case 'nutrition':
                    // This case is now intentionally empty.
                    // All nutrition totals are sourced from 'dailySummaries' to prevent double-counting.
                    break;

                case 'hydration':
                    if (typeof log.amount === 'number') {
                        day.hydration += log.amount;
                        day.hasData.add('hydration');
                    }
                    break;
                case 'sleep':
                    if (typeof log.duration === 'number') {
                        day.sleep += log.duration;
                        day.hasData.add('sleep');
                    }
                    break;
                case 'activity':
                    if (typeof log.duration === 'number') {
                        day.activity += log.duration;
                        day.hasData.add('activity');
                    }
                    break;
                case 'stress':
                     if (log.type === 'event') totalStressEvents++;
                     // Preserved working logic for Stress Relief.
                     if (log.type === 'relief') totalStressReliefs++;
                    break;
                case 'cravings':
                    if (log.type === 'craving') totalCravings++;
                    if (log.type === 'binge') totalBinges++;
                    break;
            }
        });

        let sumCalories = 0, calorieDays = 0;
        let sumUpf = 0, upfDays = 0;
        let sumHydration = 0, hydrationDays = 0;
        let sumSleep = 0, sleepDays = 0;
        let sumActivity = 0, activityDays = 0;

        for (const day of dailyData.values()) {
            if (day.hasData.has('calories') && day.calories > 0) { 
                sumCalories += day.calories; 
                calorieDays++; 
            }
            // Correctly calculate daily UPF average from all meal logs, then average those daily averages.
            if (day.hasData.has('upf')) {
                sumUpf += day.upf;
                upfDays++;
            }            
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
            stressEvents: totalStressEvents,
            stressReliefs: totalStressReliefs,
            cravings: totalCravings,
            binges: totalBinges,
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_CLOSE_CALENDAR_ID) {
                prepareInterstitialAd({ adId: process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_CLOSE_CALENDAR_ID, isTesting: false });
            }
            if (user) {
                const fetchDataAndAggregate = async () => {
                    setIsLoading(true);
                    setSummary(null);
                    try {
                        const result = await getAllDataForPeriod(insightPeriod, user.uid);
                        if (result.success && result.data) {
                            if(result.data.length === 0) {
                                 toast({ variant: 'default', title: 'Not Enough Data', description: `No data recorded in the last ${insightPeriod} days.` });
                            }
                            const summaryData = aggregateLogs(result.data as ClientLog[]);
                            setSummary(summaryData);
                        } else {
                            throw new Error(result.error || 'Failed to fetch data.');
                        }
                    } catch (error: any) {
                        toast({ variant: 'destructive', title: 'Error', description: error.message });
                    } finally {
                        setIsLoading(false);
                    }
                };
                fetchDataAndAggregate();
            }
        }
    }, [isOpen, user, insightPeriod, aggregateLogs, toast, prepareInterstitialAd]);

    const handleClose = async () => {
        await showInterstitialAd();
        onClose();
    };

    const metricCards = useMemo(() => {
        if (!summary) return [];
        const periodText = `last ${insightPeriod} days`;
        return [
            { icon: Utensils, title: "Calories", value: summary.avgCalories.value.toFixed(0), unit: "kcal", context: `${summary.avgCalories.days} / ${insightPeriod} days`},
            { icon: Percent, title: "AVG. UPF", value: summary.avgUpfPercent.value.toFixed(0), unit: "%", context: `${summary.avgUpfPercent.days} / ${insightPeriod} days`},
            { icon: Droplet, title: "Hydration", value: summary.avgHydration.value.toFixed(0), unit: "oz", context: `${summary.avgHydration.days} / ${insightPeriod} days`},
            { icon: Bed, title: "Sleep", value: summary.avgSleep.value.toFixed(1), unit: "hrs", context: `${summary.avgSleep.days} / ${insightPeriod} days`},
            { icon: Activity, title: "Activity", value: summary.avgActivity.value.toFixed(0), unit: "min", context: `${summary.avgActivity.days} / ${insightPeriod} days`} ,
            { icon: ShieldCheck, title: "Stress Relief", value: summary.stressReliefs.toString(), unit: "", context: periodText },
            { icon: AlertTriangle, title: "Stress Events", value: summary.stressEvents.toString(), unit: "", context: periodText },
            { icon: Cookie, title: "Cravings", value: summary.cravings.toString(), unit: "", context: periodText },
            { icon: CakeSlice, title: "Binges", value: summary.binges.toString(), unit: "", context: periodText }, 
        ];
    }, [summary, insightPeriod]);

    return (
        <>
        <Dialog open={isOpen} onOpenChange={handleClose}>
             <DialogContent className="w-[95vw] sm:max-w-sm p-0 grid grid-rows-[auto_auto_1fr_auto] max-h-[90dvh] bg-neutral-900 border-neutral-800">
                <DialogHeader className="p-4 pt-5 text-center">
                    <DialogTitle className="text-lg font-bold tracking-tight text-white">Data Insights</DialogTitle>
                    <DialogDescription className="text-neutral-400 text-xs">Your algorithmic data summary.</DialogDescription>
                </DialogHeader>

                <div className="px-4 py-2">
                     <Select onValueChange={(v) => setInsightPeriod(parseInt(v))} defaultValue="7">
                        <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white focus:ring-1 focus:ring-offset-0 focus:ring-offset-neutral-800 focus:ring-neutral-600">
                            <SelectValue placeholder="Select time period" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                            <SelectItem value="3">Last 3 Days</SelectItem>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="14">Last 14 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <ScrollArea className="h-full overflow-y-auto">
                    <div className="p-4 pt-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : summary ? (
                            <div className="grid grid-cols-3 gap-3">
                                {metricCards.map(card => <DataCard key={card.title} {...card} />)}
                            </div>
                        ) : (
                            <p className="text-center text-sm text-neutral-500 p-12">Select a time period to see your data.</p>
                        )}
                    </div>
                </ScrollArea>
                
                <div className="p-4 border-t border-neutral-800 space-y-2">
                    <Button variant="outline" className="w-full bg-transparent text-white border-neutral-700 hover:bg-neutral-800 hover:text-white" onClick={() => setIsWeightChartOpen(true)}>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Analyze Weight Trend
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent text-white border-neutral-700 hover:bg-neutral-800 hover:text-white" onClick={() => setIsWthrChartOpen(true)}>
                        <Heart className="mr-2 h-4 w-4" />
                        Analyze WtHR Trend
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
        
        <WeightTrendChartDialog 
            isOpen={isWeightChartOpen}
            onClose={() => setIsWeightChartOpen(false)}
        />
        <WthrTrendChartDialog 
            isOpen={isWthrChartOpen}
            onClose={() => setIsWthrChartOpen(false)}
        />
        </>
    );
}
