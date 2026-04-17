'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClientStatsDashboard } from './client-stats-dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientProfile, DailySummary } from '@/types';
import { deleteClientAction } from '@/app/coach/clients/actions';
import { getAllDataForPeriod } from '@/services/firestore';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, BarChart, Pencil, LineChart } from 'lucide-react';
import { ClientCalendarView } from './ClientCalendarView';
import { CoachNotes } from './CoachNotes';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { WeightTrendAnalysisModal } from '@/components/client/insights/weight-trend-analysis-modal';

// This interface and the aggregation logic are copied directly from the working insights-dialog.tsx
interface ClientLog {
    entryDate: string;
    pillar: string;
    type?: string;
    summary?: any;
    amount?: number;
    duration?: number;
    calories?: number;
    upf?: number;
}

interface ClientDetailModalProps {
  client: ClientProfile;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientDetailModal({ client: initialClient, isOpen, onClose }: ClientDetailModalProps) {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientProfile | null>(initialClient);
  const [liveSummary, setLiveSummary] = useState<DailySummary | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [deleteClientAlertOpen, setDeleteClientAlertOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWeightTrendModalOpen, setIsWeightTrendModalOpen] = useState(false);

  // LOGIC COPIED FROM insights-dialog.tsx
  const aggregateLogs = useCallback((logs: ClientLog[]): DailySummary => {
        const dailyData = new Map<string, any>();
        let totalStressEvents = 0;
        let totalStressReliefs = 0;
        let totalCravings = 0;
        let totalBinges = 0;

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
        
        const baseSummary = client?.dailySummary || {} as DailySummary;

        return {
            ...baseSummary,
            avgNutrients: { Energy: calorieDays > 0 ? sumCalories / calorieDays : 0 },
            avgUpf: upfDays > 0 ? sumUpf / upfDays : 0,
            avgHydration: hydrationDays > 0 ? sumHydration / hydrationDays : 0,
            avgSleep: sleepDays > 0 ? sumSleep / sleepDays : 0,
            avgActivity: activityDays > 0 ? sumActivity / activityDays : 0,
            stressEvents: totalStressEvents,
            cravings: totalCravings,
            binges: totalBinges,
            stressReliefs: totalStressReliefs,
        };
    }, [client?.dailySummary]);

  // LOGIC COPIED FROM insights-dialog.tsx
  useEffect(() => {
    if (isOpen && initialClient.uid) {
      setClient(initialClient); 
      setIsRefreshing(true);
      getAllDataForPeriod(7, initialClient.uid).then(result => {
          if (result.success && result.data) {
              const summary = aggregateLogs(result.data as ClientLog[]);
              setLiveSummary(summary);
          } else {
              toast({ variant: 'destructive', title: "Could Not Load Summary", description: "Failed to fetch recent client activity." });
          }
          setIsRefreshing(false);
      });
    }
  }, [isOpen, initialClient, aggregateLogs, toast]);

  const handleDeleteClient = async () => {
    if (!client?.uid) return;
    setIsDeletingClient(true);
    // ... delete logic
  };

  const isTrendAnalysisEnabled = client?.tier === 'premium' || client?.tier === 'coaching';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader className="p-4 border-b">
            <DialogTitle srOnly>{client?.fullName || "Client"}'s Command Center</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                  {client ? (
                      <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
                          <AccordionItem value="item-1" className="border rounded-lg overflow-hidden">
                              <AccordionTrigger className="p-4 hover:no-underline">
                                  <div className="flex items-center gap-3 flex-1">
                                      <BarChart className="mr-2 h-5 w-5"/>
                                      <div className="flex-1">
                                          <h3 className="font-semibold text-base text-left">At-a-Glance Stats</h3>
                                      </div>
                                  </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 pt-0">
                                  <ClientStatsDashboard 
                                      client={client}
                                      summary={liveSummary} 
                                      onDeleteClient={() => setDeleteClientAlertOpen(true)}
                                      isRefreshing={isRefreshing}
                                  />
                              </AccordionContent>
                          </AccordionItem>
                          
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <Button onClick={() => setIsWeightTrendModalOpen(true)} disabled={!isTrendAnalysisEnabled}>
                                <LineChart className="mr-2 h-4 w-4" />
                                Analyze Weight Trend
                              </Button>
                              <ClientCalendarView client={client} />
                          </div>

                          <AccordionItem value="item-5" className="border rounded-lg overflow-hidden">
                              <AccordionTrigger className="p-4 hover:no-underline"><Pencil className="mr-2 h-5 w-5"/> Coach Notes</AccordionTrigger>
                              <AccordionContent className="p-4 pt-0">
                                  <CoachNotes client={client} />
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                  ) : (
                     <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>

           <AlertDialog open={deleteClientAlertOpen} onOpenChange={setDeleteClientAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. This will permanently delete your client's account and all associated data.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteClient} disabled={isDeletingClient} className="bg-destructive hover:bg-destructive/90">
                        {isDeletingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Client
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>
        </DialogContent>
      </Dialog>

      {client && (
        <WeightTrendAnalysisModal
          isOpen={isWeightTrendModalOpen}
          onClose={() => setIsWeightTrendModalOpen(false)}
          clientId={client.uid}
        />
      )}
    </>
  );
}
