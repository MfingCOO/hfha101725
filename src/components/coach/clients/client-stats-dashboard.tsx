'use client';
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientProfile, DailySummary } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Droplet, Bed, Utensils, Activity, AlertTriangle, ShieldCheck, Cookie, CakeSlice, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { differenceInDays, format, parseISO } from 'date-fns';
import type { LucideIcon } from 'lucide-react';

interface ClientStatsDashboardProps {
  client: ClientProfile;
  onDeleteClient: () => void;
  isRefreshing: boolean;
}

const SummaryStat = ({ title, value }: { title: string; value: string | number }) => (
    <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="font-bold text-sm">{value || 'N/A'}</p>
    </div>
);

const MetricCard = ({ icon: Icon, title, value, unit, context }: { icon: LucideIcon, title: string, value: string, unit: string, context: string }) => (
    <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-lg p-2.5 flex flex-col aspect-square justify-between shadow-md">
        <div className="flex justify-between items-start">
            <span className="text-xs text-neutral-400 whitespace-pre-wrap">{title}</span>
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

// **THE FIX**: Helper to get the most recent summary, not just today's.
const getLatestSummary = (summaries: { [date: string]: DailySummary } | undefined): DailySummary | undefined => {
    if (!summaries || Object.keys(summaries).length === 0) {
        return undefined;
    }
    const sortedDates = Object.keys(summaries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return summaries[sortedDates[0]];
};

export function ClientStatsDashboard({
  client,
  onDeleteClient,
  isRefreshing,
}: ClientStatsDashboardProps) {

    // **THE FIX**: Use the helper to find the latest summary, removing the dependency on 'today'.
    const latestSummary = useMemo(() => getLatestSummary(client.dailySummaries), [client.dailySummaries]);

    const metricCards = useMemo(() => {
        if (!latestSummary) return []; // Use latestSummary
        const insightPeriod = 7; 

        return [
            { icon: Utensils, title: "Calories", value: (latestSummary.avgNutrients?.Energy || 0).toFixed(0), unit: "kcal", context: `avg/${insightPeriod}d`},
            { icon: Percent, title: "AVG. UPF", value: (latestSummary.avgUpf || 0).toFixed(0), unit: "%", context: `avg/${insightPeriod}d`},
            { icon: Droplet, title: "Hydration", value: (latestSummary.avgHydration || 0).toFixed(0), unit: "oz", context: `avg/${insightPeriod}d`},
            { icon: Bed, title: "Sleep", value: (latestSummary.avgSleep || 0).toFixed(1), unit: "hrs", context: `avg/${insightPeriod}d`},
            { icon: Activity, title: "Activity", value: (latestSummary.avgActivity || 0).toFixed(0), unit: "min", context: `avg/${insightPeriod}d`},
            { icon: ShieldCheck, title: "Stress Events", value: (latestSummary.stressEvents || 0).toString(), unit: "", context: `last ${insightPeriod}d` },
            { icon: AlertTriangle, title: "Cravings", value: (latestSummary.cravings || 0).toString(), unit: "", context: `last ${insightPeriod}d` },
            { icon: CakeSlice, title: "Binges", value: (latestSummary.binges || 0).toString(), unit: "", context: `last ${insightPeriod}d` }, 
        ];
    }, [latestSummary]);
    
    const durationInDays = client.createdAt ? differenceInDays(new Date(), parseISO(client.createdAt as string)) : 0;

    return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        <div className="flex justify-between items-start">
            <div>
                <h3 className="text-lg font-bold truncate">{client.fullName}</h3>
                <p className="text-sm text-muted-foreground truncate">{client.email}</p>
            </div>
            <div className="flex-shrink-0 flex gap-2">
                <Button onClick={onDeleteClient} variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>

        <Separator />
        
        <div className="flex flex-wrap justify-around items-center gap-4">
            {/* **THE FIX**: Pull data from `latestSummary` and the root `client` object. */}
            <SummaryStat title="Weight" value={`${latestSummary?.currentWeight || 'N/A'} ${latestSummary?.unit || 'lbs'}`} />
            <SummaryStat title="WtHR" value={latestSummary?.currentWthr?.toFixed(2) || 'N/A'} />
            <SummaryStat title="DOB" value={client.dob || 'N/A'} />
            <SummaryStat title="Sex" value={client.sex ? client.sex.charAt(0).toUpperCase() : 'N/A'} />
            <SummaryStat title="Duration" value={`${durationInDays}d`} />
        </div>
        
        <Separator />

        {isRefreshing ? (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        // **THE FIX**: Check for latestSummary instead of the old, broken 'summary' variable.
        ) : latestSummary ? (
            <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(100px,1fr))]">
                {metricCards.map(card => <MetricCard key={card.title} {...card} />)}
            </div>
        ) : (
            <p className="text-center text-sm text-neutral-500 py-12">No summary available for today.</p>
        )}

      </CardContent>
    </Card>
  );
}
