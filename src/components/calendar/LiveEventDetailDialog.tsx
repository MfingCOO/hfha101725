'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2, Trash2, Calendar, Clock, Info, Video } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { deleteCalendarEventAction } from '@/app/client/actions';

interface LiveEventDetailDialogProps {
  isOpen: boolean;
  onClose: (wasChanged: boolean) => void;
  event: any | null;
}

export function LiveEventDetailDialog({ isOpen, onClose, event }: LiveEventDetailDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!event?.id) return;
    setIsDeleting(true);

    const result = await deleteCalendarEventAction(event.id);

    // DEFINITIVE AND FINAL FIX: Use the 'in' operator for explicit type guarding.
    // This is the most robust way to check for the error case.
    if ('error' in result) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to cancel attendance.',
      });
      setIsDeleting(false);
      return;
    }

    // If we reach here, the action was successful.
    toast({ title: 'Attendance Cancelled', description: 'The event has been removed from your calendar.' });
    onClose(true);
    setIsDeleting(false);
  };

  if (!event) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(false);
    }
  };

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const hasNotes = event.description && event.description.trim().length > 0;
  const hasVideoLink = event.videoCallLink && event.videoCallLink.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            Details for this upcoming live event.
          </DialogDescription>
        </DialogHeader>
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
          {hasNotes && (
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-1 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Event Details</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 justify-between">
          <div className="flex gap-2">
            {hasVideoLink && (
              <Button asChild>
                <Link href={event.videoCallLink} target="_blank">
                  <Video className="mr-2 h-4 w-4" />
                  Join Live Event
                </Link>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Cancel Attendance
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
