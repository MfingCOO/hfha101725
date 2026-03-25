'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCalendarEventAction } from '@/app/coach/events/actions';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Trash2, Calendar, Clock, Info, Video, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientProfile } from '@/types';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: (wasDeleted: boolean) => void;
  event?: any | null;
  appointmentId?: string;
  client?: ClientProfile;
  appointmentStartTimeMillis?: string; // NEW: Prop for localized time
}

export function AppointmentDetailDialog({ isOpen, onClose, event, appointmentId, client, appointmentStartTimeMillis }: AppointmentDetailDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [appointment, setAppointment] = useState(event);
  const [isLoading, setIsLoading] = useState(false);
  const [displayTime, setDisplayTime] = useState<string | null>(null); // NEW: State for localized display time

  useEffect(() => {
    // If raw milliseconds are provided, use them for time zone localization
    if (appointmentStartTimeMillis) {
      const date = new Date(Number(appointmentStartTimeMillis));
      // Format for display in user's local time zone
      setDisplayTime(date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }));
    } else if (event?.start) {
      // Fallback to event.start if available, but might not be localized
      const date = event.start?.toDate ? event.start.toDate() : new Date(event.start);
      setDisplayTime(date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }));
    }
  }, [appointmentStartTimeMillis, event]);

  useEffect(() => {
    // If the event object is passed directly, use it.
    if (event) {
      setAppointment(event);
      return;
    }

    // If an appointmentId is passed (from a notification), fetch the data.
    if (isOpen && appointmentId) {
      const fetchAppointment = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'coachCalendar', appointmentId);
          const auth = getAuth();

          // **Granular Logging for Debugging** (as previously added)
          console.log("Debugging Appointment Fetch:");
          console.log("  Firestore Path:", docRef.path);
          console.log("  Auth Current User:", auth.currentUser);
          console.log("  User ID (auth.currentUser?.uid):", auth.currentUser?.uid);
          console.log("  Appointment ID:", appointmentId);

          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Manually convert Timestamps to Dates, as they are not automatically converted
            const start = data.start?.toDate ? data.start.toDate() : new Date(data.start);
            const end = data.end?.toDate ? data.end.toDate() : new Date(data.end);
            setAppointment({ id: docSnap.id, ...data, start, end });

            // If appointmentStartTimeMillis was provided, it takes precedence for display
            if (!appointmentStartTimeMillis) { // Only set if not already set by prop
                setDisplayTime(start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }));
            }

          } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Appointment not found.' });
            onClose(false);
          }
        } catch (error) {
          console.error("Error fetching appointment:", error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load appointment details.'
          });
          onClose(false);
        } finally {
          setIsLoading(false);
        }
      };
      fetchAppointment();
    }
  }, [isOpen, appointmentId, event, toast, onClose, appointmentStartTimeMillis]);

  const handleDelete = async () => {
    if (!appointment?.id) return;
    setIsDeleting(true);
    try {
      const result = await deleteCalendarEventAction(appointment.id);

      if (result.success) {
        toast({
          title: 'Appointment Cancelled',
          description: 'The appointment has been removed from your calendar.'
        });
        onClose(true);
      } else {
        throw new Error(result.error || 'Failed to cancel appointment.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderContent = () => {
    if (isLoading || !appointment) {
      return (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-24" /></div>
          <div className="flex items-center gap-3"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-32" /></div>
          <div className="flex items-center gap-3"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-28" /></div>
        </div>
      );
    }

    const startDate = new Date(appointment.start);
    const hasNotes = appointment.description && appointment.description.trim().length > 0;
    const hasVideoLink = appointment.videoCallLink && appointment.videoCallLink.trim().length > 0;

    return (
      <>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground"/>
            <div className="text-sm">
              <p className="font-medium">Date</p>
              <p className="text-muted-foreground">{format(startDate, 'PPPP')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground"/>
            <div className="text-sm">
              <p className="font-medium">Time</p>
              {/* **MODIFIED:** Display localized time from state or fallback */}
              <p className="text-muted-foreground">{displayTime ? `${displayTime}` : `${format(startDate, 'p')} - ${format(appointment.end, 'p')}`}</p>
            </div>
          </div>
          {appointment.coachName && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground"/>
              <div className="text-sm">
                <p className="font-medium">With Coach</p>
                <p className="text-muted-foreground">{appointment.coachName}</p>
              </div>
            </div>
          )}
          {hasNotes && (
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-1 text-muted-foreground"/>
              <div className="text-sm">
                <p className="font-medium">Notes from Coach</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{appointment.description}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {hasVideoLink ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href={appointment.videoCallLink} target="_blank">
                <Video className="mr-2 h-4 w-4" />
                Join Appointment
              </Link>
            </Button>
          ) : (
            <div /> // Placeholder to keep spacing consistent
          )}

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1 sm:flex-auto">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Cancel
            </Button>
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 sm:flex-auto">Close</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment?.title || 'Loading Appointment...'}</DialogTitle>
          <DialogDescription>
            Details for your upcoming appointment.
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
