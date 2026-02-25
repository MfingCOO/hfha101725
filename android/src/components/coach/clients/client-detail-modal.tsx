'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClientStatsDashboard } from './client-stats-dashboard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ClientProfile } from '@/types';
// FIX: getClientByIdAction is now needed for the 'read it again' logic.
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
import { Loader2, BarChart, MessageSquare, Pencil } from 'lucide-react';
import { ClientCalendarView } from './ClientCalendarView';
import { CoachNotes } from './CoachNotes';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EmbeddedChatDialog } from '../chats/embedded-chat-dialog';

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
  const [chatInfo, setChatInfo] = useState<{ id: string; name: string } | null>(null);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);

  // FIX: This function now implements the correct 'update and re-read' logic.
  const handleRefreshAndRefetch = useCallback(async (showToast = true) => {
    if (!initialClient.uid) return;
    setIsRefreshing(true);
    try {
        // 1. Trigger the summary calculation. We don't need its return value.
        await calculateDailySummaries({ clientId: initialClient.uid });

        // 2. 'Read it again': Re-fetch the entire client profile.
        const updatedClientResult = await getClientByIdAction(initialClient.uid);

        if (updatedClientResult.success && updatedClientResult.data) {
            // 3. Update the state with the complete, fresh client object.
            setClient(updatedClientResult.data);
            if (showToast) {
                toast({
                    title: "Stats Refreshed",
                    description: `${initialClient.fullName}'s summary is now up-to-date.`,
                });
            }
        } else {
             throw new Error(updatedClientResult.error || "Could not refetch client data.");
        }
    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: "Update Failed",
            description: error.message
        });
    } finally {
        setIsRefreshing(false);
    }
  }, [initialClient.uid, initialClient.fullName, toast]);

  useEffect(() => {
    if (isOpen && initialClient.uid) {
      setClient(initialClient);
      handleRefreshAndRefetch(false); 
    }
  }, [isOpen, initialClient, handleRefreshAndRefetch]);

  useEffect(() => {
      if (isOpen && initialClient.uid && initialClient.tier === 'coaching') {
          getCoachingChatIdForClient(initialClient.uid).then(result => {
              if (result.success && result.chatId) {
                  setChatInfo({ id: result.chatId, name: `${initialClient.fullName} Coaching` });
              }
          });
      } else {
          setChatInfo(null);
      }
  }, [isOpen, initialClient.uid, initialClient.tier, initialClient.fullName]);

  const handleDeleteClient = async () => {
    if (!client?.uid) return;
    setIsDeletingClient(true);
    try {
        const result = await deleteClientAction(client.uid);
        if (result.success) {
            toast({ title: "Client Deleted", description: "The client and their data have been removed." });
            onClose(); 
        } else {
            throw new Error(result.error || "Could not delete the client.");
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Deletion Failed", description: error.message });
    } finally {
        setIsDeletingClient(false);
        setDeleteClientAlertOpen(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90dvh] max-w-4xl flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle srOnly>{client?.fullName || "Client"}'s Command Center</DialogTitle>
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
                                {/* FIX: Removed the unnecessary key prop. */}
                                <ClientStatsDashboard 
                                    client={client}
                                    onDeleteClient={() => setDeleteClientAlertOpen(true)}
                                    onRefresh={() => handleRefreshAndRefetch(true)}
                                    isRefreshing={isRefreshing}
                                />
                            </AccordionContent>
                        </AccordionItem>
                        
                         <div className="grid grid-cols-2 gap-4">
                             <Button onClick={() => setIsChatDialogOpen(true)} disabled={!chatInfo}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Open Chat
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
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {client?.fullName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action is irreversible. It will permanently delete the client's account, all their data, and their access to the app.
                    </AlertDialogDescription>
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

     {chatInfo && (
        <EmbeddedChatDialog 
            isOpen={isChatDialogOpen}
            onClose={() => setIsChatDialogOpen(false)}
            chatId={chatInfo.id}
            chatName={chatInfo.name}
        />
    )}
    </>
  );
}
