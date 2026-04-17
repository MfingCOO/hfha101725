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
  client: ClientProfile | null;
  summary: DailySummary | null;
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

export function ClientStatsDashboard({
  client,
  summary,
  onDeleteClient,
  isRefreshing,
}: ClientStatsDashboardProps) {

    const latestSummary = summary;

    const displayWeight = useMemo(() => {
        const weight = latestSummary?.currentWeight ?? client?.onboarding?.weight;
        const unit = latestSummary?.unit ?? (client?.onboarding?.units === 'imperial' ? 'lbs' : 'kg');
        return weight ? `${weight} ${unit}` : 'N/A';
    }, [latestSummary, client?.onboarding]);

    const displayWthr = useMemo(() => {
        let wthr = latestSummary?.currentWthr;
        if (!wthr) {
            const waist = client?.onboarding?.waist;
            const height = client?.onboarding?.height;
            if (waist && height && height > 0) {
                wthr = waist / height;
            }
        }
        return wthr ? wthr.toFixed(2) : 'N/A';
    }, [latestSummary, client?.onboarding]);

    const metricCards = useMemo(() => {
        if (!latestSummary) return []; 
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
    
    const durationInDays = client?.createdAt ? differenceInDays(new Date(), new Date(client.createdAt as any)) : 0;

    if (!client) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

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
            <SummaryStat title="Weight" value={displayWeight} />
            <SummaryStat title="WtHR" value={displayWthr} />
            <SummaryStat title="DOB" value={client.onboarding?.birthdate ? format(new Date(client.onboarding.birthdate), 'MM/dd/yyyy') : 'N/A'} />
            <SummaryStat title="Sex" value={client.onboarding?.sex ? client.onboarding.sex.charAt(0).toUpperCase() : 'N/A'} />
            <SummaryStat title="Duration" value={`${durationInDays}d`} />
        </div>
        
        <Separator />

        {isRefreshing ? (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
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
