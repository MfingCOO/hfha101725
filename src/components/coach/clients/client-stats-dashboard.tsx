'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ClientProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Moon, Flame, UtensilsCrossed, Apple, HeartCrack, ShieldAlert, Percent } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { differenceInDays } from 'date-fns';
import type { LucideIcon } from 'lucide-react';
import { getClientByIdAction } from '@/app/coach/clients/actions';
import { useToast } from '@/hooks/use-toast';

interface ClientStatsDashboardProps {
  client: ClientProfile;
  onDeleteClient: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const MiniStat = ({ icon: Icon, value, unit }: { icon: LucideIcon; value: string; unit: string }) => (
  <div className="flex flex-col items-center gap-0.5">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="text-xs font-bold">{value}</span>
    <span className="text-[10px] text-muted-foreground -mt-1">{unit}</span>
  </div>
);

const StaticInfo = ({ title, value }: { title: string; value: string | number }) => (
    <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="font-bold text-sm">{value}</p>
    </div>
);

export function ClientStatsDashboard({
  client: initialClient,
  onDeleteClient,
  onRefresh,
  isRefreshing,
}: ClientStatsDashboardProps) {

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchFullClientData = async () => {
      if (!initialClient.uid) {
        toast({ variant: 'destructive', title: 'Cannot load client data: No ID provided.'});
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const result = await getClientByIdAction(initialClient.uid);
      if (result.success && result.data) {
        setClient(result.data);
      } else {
        toast({ variant: 'destructive', title: 'Failed to load client stats', description: result.error });
      }
      setIsLoading(false);
    };

    fetchFullClientData();
  }, [initialClient.uid, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return <p className="text-center text-destructive">Could not load client statistics.</p>;
  }
  
  // --- GENIE'S "PUT IT ALL TOGETHER" FIX ---
  // Reverting to the single, stable data source that was almost perfect.
  const getMostRecentSummary = (summaries: ClientProfile['dailySummaries']) => {
    if (!summaries || typeof summaries !== 'object' || Object.keys(summaries).length === 0) return null;
    const sortedDates = Object.keys(summaries).sort((a, b) => b.localeCompare(a));
    return summaries[sortedDates[0]];
  };
  const summary = getMostRecentSummary(client.dailySummaries) as any;
  
  const onboarding = client.onboarding;

  const getStatValue = (value: any, fractionDigits = 0) => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(fractionDigits);
  }

  const durationInDays = client.createdAt ? differenceInDays(new Date(), new Date(client.createdAt as string)) : 0;
  const age = onboarding?.birthdate ? Math.floor(differenceInDays(new Date(), new Date(onboarding.birthdate)) / 365.25) : 'N/A';
  const weightUnit = onboarding?.units === 'metric' ? 'kg' : 'lbs';

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{client.fullName}</h3>
            <p className="text-sm text-muted-foreground truncate">{client.email}</p>
          </div>
          <div className="flex-shrink-0 flex gap-2">
            <Button onClick={onRefresh} disabled={true} size="sm">
              {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh
            </Button>
            <Button onClick={onDeleteClient} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />
        
        <div className="grid grid-cols-5 gap-1">
            {/* All stats now pull from the single, reliable summary object */}
            <StaticInfo title="Weight" value={`${getStatValue(summary?.currentWeight, 1)} ${weightUnit}`} />
            <StaticInfo title="WtHR" value={getStatValue(summary?.currentWthr, 2)} />
            <StaticInfo title="Age" value={age} />
            <StaticInfo title="Sex" value={onboarding?.sex ? onboarding.sex.charAt(0).toUpperCase() : 'N/A'} />
            <StaticInfo title="Duration" value={`${durationInDays}d`} />
        </div>
        
        <Separator />

        <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 text-center">7-DAY AVERAGES</h4>
            <div className="grid grid-cols-4 gap-2">
                <MiniStat icon={Moon} value={getStatValue(summary?.avgSleep, 1)} unit="hr" />
                <MiniStat icon={Flame} value={getStatValue(summary?.avgActivity)} unit="min" />
                {/* The final fix for the last two incorrect fields */}
                <MiniStat icon={UtensilsCrossed} value={getStatValue(summary?.avgNutrients?.Energy)} unit="kcal" />
                <MiniStat icon={Percent} value={getStatValue(summary?.avgUpf, 1)} unit="%" />
            </div>
        </div>
        
        <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 text-center">7-DAY TOTALS</h4>
             <div className="grid grid-cols-3 gap-2">
                <MiniStat icon={Apple} value={getStatValue(summary?.cravings)} unit="Cravings" />
                <MiniStat icon={HeartCrack} value={getStatValue(summary?.binges)} unit="Binges" />
                <MiniStat icon={ShieldAlert} value={getStatValue(summary?.stressEvents)} unit="Stress" />
            </div>
        </div>

      </CardContent>
    </Card>
  );
}
