'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClientStatsDashboard } from './client-stats-dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientProfile } from '@/types';
import { getCoachingChatIdForClient, deleteClientAction, getClientByIdAction } from '@/app/coach/clients/actions';
import { calculateDailySummaries } from '@/ai/flows/calculate-daily-summaries';
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
import { WeightTrendAnalysisModal } from '@/components/client/insights/weight-trend-analysis-modal'; // THE FIX: Corrected import path

interface ClientDetailModalProps {
  client: ClientProfile;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientDetailModal({ client: initialClient, isOpen, onClose }: ClientDetailModalProps) {
  const { toast } = useToast();
  const [client, setClient] = useState<ClientProfile | null>(initialClient);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [deleteClientAlertOpen, setDeleteClientAlertOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWeightTrendModalOpen, setIsWeightTrendModalOpen] = useState(false);

  const handleRefreshAndRefetch = useCallback(async (showToast = true) => {
    if (!initialClient.uid) return;
    setIsRefreshing(true);
    try {
        await calculateDailySummaries({ clientId: initialClient.uid, dryRun: false });
        const updatedClientResult = await getClientByIdAction(initialClient.uid);
        if (updatedClientResult.success && updatedClientResult.data) {
            setClient(updatedClientResult.data);
            if (showToast) {
                toast({ title: "Stats Refreshed", description: `${initialClient.fullName}\'s summary is now up-to-date.` });
            }
        } else {
             throw new Error(updatedClientResult.error || "Could not refetch client data.");
        }
    } catch (error: any) {
         toast({ variant: 'destructive', title: "Update Failed", description: error.message });
    } finally {
        setIsRefreshing(false);
    }
  }, [initialClient.uid, initialClient.fullName, toast]);

  useEffect(() => {
    if (isOpen && initialClient.uid) {
      setClient(initialClient);
    }
  }, [isOpen, initialClient]);

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
            <DialogTitle srOnly>{client?.fullName || "Client"}\'s Command Center</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                  {client && (
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
                  )}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>

           <AlertDialog open={deleteClientAlertOpen} onOpenChange={setDeleteClientAlertOpen}>
             {/* ... (Alert dialog) ... */}
           </AlertDialog>
        </DialogContent>
      </Dialog>

      {client && (
        <WeightTrendAnalysisModal
          isOpen={isWeightTrendModalOpen}
          onClose={() => setIsWeightTrendModalOpen(false)}
          clientId={client.uid} // THE FIX: Pass the client's ID
        />
      )}
    </>
  );
}