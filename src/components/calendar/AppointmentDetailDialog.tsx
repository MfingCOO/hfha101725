'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ClientProfile } from '@/types';

interface AppointmentDetailDialogProps {
  isOpen: boolean;
  onClose: (wasDeleted: boolean) => void;
  event?: any | null;
  appointmentId?: string;
  client?: ClientProfile;
}

export function AppointmentDetailDialog({
  isOpen,
  onClose,
  event,
  appointmentId,
  client,
}: AppointmentDetailDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [appointment, setAppointment] = useState(event);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    // If event is passed directly, use it immediately
    if (event) {
      setAppointment(event);
      setFetchError(null);
      return;
    }

    // If appointmentId is passed (e.g. from notification), fetch it
    if (isOpen && appointmentId) {
      const fetchAppointment = async () => {
        setIsLoading(true);
        setFetchError(null);

        // Guard: wait for auth/user to be ready
        if (!appointmentId || !client) {
          console.warn('[AppointmentDialog] Fetch skipped - missing appointmentId or client profile');
          setFetchError('Appointment details not available yet. Please try again.');
          setIsLoading(false);
          return;
        }

        console.log('[AppointmentDialog] Fetch start');
        console.log(' - Appointment ID:', appointmentId);
        console.log(' - Current client UID:', client.uid);
        console.log(' - Client profile loaded:', !!client);

        try {
          const docRef = doc(db, 'coachCalendar', appointmentId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('[AppointmentDialog] Doc exists - data:', data);
            console.log(' - clientId in doc:', data.clientId);
            console.log(' - Matches current UID?', data.clientId === client.uid);

            // Convert Firestore Timestamps to Dates
            const start = data.start?.toDate ? data.start.toDate() : new Date(data.start);
            const end = data.end?.toDate ? data.end.toDate() : new Date(data.end);

            setAppointment({ id: docSnap.id, ...data, start, end });
          } else {
            console.log('[AppointmentDialog] Doc does NOT exist for ID:', appointmentId);
            setFetchError('This appointment could not be found.');
            toast({
              variant: 'destructive',
              title: 'Not Found',
              description: 'The appointment no longer exists.',
            });
            onClose(false);
          }
        } catch (error: any) {
          console.error('[AppointmentDialog] Fetch error:', error);
          console.error(' - Code:', error.code);
          console.error(' - Message:', error.message);

          const errorMsg = error.code === 'permission-denied'
            ? 'You do not have permission to view this appointment.'
            : 'Could not load appointment details.';

          setFetchError(errorMsg);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: errorMsg,
          });
          onClose(false);
        } finally {
          setIsLoading(false);
        }
      };

      fetchAppointment();
    }
  }, [isOpen, appointmentId, event, client, toast, onClose]);

  const handleDelete = async () => {
    if (!appointment?.id) return;
    setIsDeleting(true);
    try {
      const result = await deleteCalendarEventAction(appointment.id);
      if (result.success) {
        toast({
          title: 'Appointment Cancelled',
          description: 'The appointment has been removed from your calendar.',
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
    if (isLoading) {
      return (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
      );
    }

    if (fetchError) {
      return (
        <div className="py-6 text-center text-muted-foreground">
          <p>{fetchError}</p>
          <p className="mt-2 text-sm">Please try again or contact support.</p>
        </div>
      );
    }

    if (!appointment) {
      return (
        <div className="py-6 text-center text-muted-foreground">
          <p>Appointment details not available.</p>
        </div>
      );
    }

    const startDate = new Date(appointment.start);
    const endDate = new Date(appointment.end);
    const hasNotes = appointment.description && appointment.description.trim().length > 0;
    const hasVideoLink = appointment.videoCallLink && appointment.videoCallLink.trim().length > 0;

    return (
      <>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Date</p>
              <p className="text-muted-foreground">{format(startDate, 'PPPP')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Time</p>
              <p className="text-muted-foreground">{`${format(startDate, 'p')} - ${format(endDate, 'p')}`}</p>
            </div>
          </div>
          {appointment.coachName && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">With Coach</p>
                <p className="text-muted-foreground">{appointment.coachName}</p>
              </div>
            </div>
          )}
          {hasNotes && (
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-1 text-muted-foreground" />
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
            <div /> // Placeholder
          )}

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 sm:flex-auto"
            >
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
          <DialogDescription>Details for your upcoming appointment.</DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}