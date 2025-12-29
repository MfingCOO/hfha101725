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

// Final, definitive component. Logic is rewritten based on user guidance.

interface InsightsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Simplified data structure based on user feedback.
interface ClientLog {
    entryDate: string;
    pillar: string;
    type: string;
    totalCalories?: number; // From daily nutrition summary log
    upfPercentage?: number; // From daily nutrition summary log
    amount?: number;        // For Hydration
    duration?: number;      // For Sleep and Activity
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
    <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-lg p-3 flex flex-col aspect-square justify-between shadow-md">
        <div className="h-[40px]"> 
            <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-neutral-400 whitespace-pre-wrap">{title}</span>
                <Icon className="h-4 w-4 text-neutral-500 shrink-0" />
            </div>
        </div>
        <div>
            <p className="text-3xl font-bold text-white tracking-tighter">
                {value}
                <span className="text-lg font-medium text-neutral-300 ml-1">{unit}</span>
            </p>
            <p className="text-xs text-neutral-500 -mt-1">{context}</p>
        </div>
    </div>
);

export function InsightsDialog({ isOpen, onClose }: InsightsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    
    const [summary, setSummary] = useState<AggregatedSummaryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [insightPeriod, setInsightPeriod] = useState<number>(7);
    const [isWeightChartOpen, setIsWeightChartOpen] = useState(false);
    const [isWthrChartOpen, setIsWthrChartOpen] = useState(false);

    // Definitive logic based on user's direct feedback.
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
                    calories: 0, upf: 0, hydration: 0, sleep: 0, activity: 0,
                    hasData: new Set<string>()
                });
            }
            const day = dailyData.get(date);

            switch (log.pillar) {
                case 'nutrition':
                    // Assign pre-calculated values from the daily summary log.
                    if (typeof log.totalCalories === 'number') {
                        day.calories = log.totalCalories;
                        day.hasData.add('calories');
                    }
                    if (typeof log.upfPercentage === 'number') {
                        day.upf = log.upfPercentage;
                        day.hasData.add('upf');
                    }
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
                     // Restored previously working logic for Stress Relief.
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
            if (day.hasData.has('calories')) { sumCalories += day.calories; calorieDays++; }
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
            stressEvents: totalStressEvents,
            stressReliefs: totalStressReliefs,
            cravings: totalCravings,
            binges: totalBinges,
        };
    }, []);

    useEffect(() => {
        if (isOpen && user) {
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
    }, [isOpen, user, insightPeriod, aggregateLogs, toast]);

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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-sm p-0 flex flex-col bg-neutral-900 border-neutral-800">
                <DialogHeader className="p-4 pt-5 flex-shrink-0 text-center">
                    <DialogTitle className="text-lg font-bold tracking-tight text-white">Data Insights</DialogTitle>
                    <DialogDescription className="text-neutral-400 text-xs">Your algorithmic data summary.</DialogDescription>
                </DialogHeader>

                <div className="px-4 py-2 flex-shrink-0">
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

                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="p-4">
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
                </div>
                
                <div className="p-4 border-t border-neutral-800 space-y-2 flex-shrink-0">
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
