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
import { useState, useEffect } from 'react';
import { Loader2, Trash2, Calendar, Clock, Info, Video } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { deleteCalendarEventAction, getVideoCallLinkAction } from '@/app/client/actions';

interface LiveEventDetailDialogProps {
  isOpen: boolean;
  onClose: (wasChanged: boolean) => void;
  event: any | null;
}

export function LiveEventDetailDialog({ isOpen, onClose, event }: LiveEventDetailDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [videoLink, setVideoLink] = useState<string | null>(null);
  const [isLoadingLink, setIsLoadingLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchLink = async () => {
        setIsLoadingLink(true);
        const result = await getVideoCallLinkAction();
        if (result.success && result.data?.link) {
          setVideoLink(result.data.link);
        }
        setIsLoadingLink(false);
      };
      fetchLink();
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!event?.id) return;
    setIsDeleting(true);
    const result = await deleteCalendarEventAction(event.id);
    if (result.success) {
      toast({ title: 'Attendance Cancelled', description: 'The event has been removed from your calendar.' });
      onClose(true);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to cancel attendance.' });
    }
    setIsDeleting(false);
  };

  if (!event) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(false);
    }
  };

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const hasNotes = event.description && event.description.trim().length > 0;
  const hasVideoLink = !!videoLink;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>Details for this upcoming live event.</DialogDescription>
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
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            {hasVideoLink && (
              <Button asChild className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white">
                <Link href={videoLink} target="_blank">
                  <Video className="mr-2 h-4 w-4" />
                  Join Live Event
                </Link>
              </Button>
            )}
            {isLoadingLink && !hasVideoLink && (
                 <Button disabled className="flex-1 sm:flex-none">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Link...
                </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="flex-1 sm:flex-none">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Cancel Attendance
            </Button>
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">Close</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
