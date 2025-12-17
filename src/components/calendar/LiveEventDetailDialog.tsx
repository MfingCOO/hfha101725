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
import { useState } from 'react';
import { Calendar, Clock, Info, Video } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface LiveEventDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: any | null;
}

export function LiveEventDetailDialog({ isOpen, onClose, event }: LiveEventDetailDialogProps) {
  if (!event) {
    return null;
  }

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const hasNotes = event.description && event.description.trim().length > 0;
  const hasVideoLink = event.videoCallLink && event.videoCallLink.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            Details for this upcoming live event.
          </DialogDescription>
        </DialogHeader>
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
                    <p className="text-muted-foreground">{`${format(startDate, 'p')} - ${format(endDate, 'p')}`}</p>
                </div>
            </div>
            {hasNotes && (
                 <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 mt-1 text-muted-foreground"/>
                    <div className="text-sm">
                        <p className="font-medium">Event Details</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                    </div>
                </div>
            )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {hasVideoLink ? (
                 <Button asChild className="w-full sm:w-auto">
                    <Link href={event.videoCallLink} target="_blank">
                        <Video className="mr-2 h-4 w-4" />
                        Join Live Event
                    </Link>
                </Button>
            ) : (
                <div /> // Placeholder to keep spacing consistent
            )}
           
            <div className="flex gap-2 w-full sm:w-auto">
                <DialogClose asChild>
                    <Button variant="outline" className="w-full">Close</Button>
                </DialogClose>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
