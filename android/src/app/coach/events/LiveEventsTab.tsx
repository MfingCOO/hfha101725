'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLiveEvents, deleteLiveEvent } from './actions';
import type { LiveEvent, UserProfile } from '@/types';
import { Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { UpsertEventDialog } from './UpsertEventDialog';

interface LiveEventWithAttendees extends LiveEvent {
    attendeeDetails: UserProfile[];
}

export function LiveEventsTab() {
  const [events, setEvents] = useState<LiveEventWithAttendees[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogState, setDialogState] = useState<{ open: boolean, event: LiveEventWithAttendees | null }>({ open: false, event: null });
  const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, eventId: string | null }>({ open: false, eventId: null });
  const { toast } = useToast();

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const result = await getLiveEvents();
      if (result.success) {
        setEvents(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to fetch events.');
      }
    } catch (e: any) {
      toast({
        title: 'Error Fetching Events',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteAlertState.eventId) return;
    try {
        const result = await deleteLiveEvent({ eventId: deleteAlertState.eventId });
        if (result.success) {
            toast({ title: 'Success', description: 'Event deleted successfully.' });
            fetchEvents();
        } else {
            throw new Error(result.error || 'Failed to delete event.');
        }
    } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeleteAlertState({ open: false, eventId: null });
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
        <div className="space-y-3">
            {events.length > 0 ? (
                events.map(event => (
                <div key={event.id} className="p-3 border rounded-lg bg-card">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-semibold text-sm">{event.title}</h3>
                            <p className="text-xs text-muted-foreground">
                                {new Date(event.eventTimestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </div>
                        <div className="flex items-center">
                             <div className="text-right flex-shrink-0 ml-4">
                                <p className="font-bold">{event.attendees.length}</p>
                                <p className="text-xs text-muted-foreground">Signed Up</p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="ml-2 h-8 w-8 flex-shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setDialogState({ open: true, event })}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, eventId: event.id })} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <div className="mt-2">
                        <h4 className="text-xs font-semibold">Attendees:</h4>
                        {event.attendeeDetails && event.attendeeDetails.length > 0 ? (
                            <ul className="text-xs text-muted-foreground columns-2">
                                {event.attendeeDetails.map(a => <li key={a.uid} className="truncate">{a.fullName}</li>)}
                            </ul>
                        ) : ( <p className="text-xs text-muted-foreground italic">No one has signed up yet.</p> )}
                    </div>
                </div>
            )))
            : (
                <div className="text-center text-muted-foreground p-8 text-sm">
                    <p>No upcoming events.</p>
                </div>
            )}
        </div>

        <UpsertEventDialog
            open={dialogState.open}
            onOpenChange={(open) => setDialogState({ open, event: open ? dialogState.event : null })}
            onEventUpserted={fetchEvents}
            initialData={dialogState.event}
        />

        <AlertDialog open={deleteAlertState.open} onOpenChange={() => setDeleteAlertState({ open: false, eventId: null })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the event. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
