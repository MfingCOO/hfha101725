'use client';

import { useState, useEffect } from 'react';
import { getUpcomingLiveEvent } from '@/app/coach/events/actions';

// Guard for hydration safety
if (typeof window === 'undefined') {
  throw new Error('This component must run on client only');
}
import { AllEventsDialog } from './AllEventsDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CalendarPlus } from 'lucide-react';
import type { LiveEvent, ClientProfile } from '@/types';

interface UpcomingEventWidgetProps {
  clientProfile: ClientProfile | null;
  onOpenUpgradeModal: () => void;
}

export function UpcomingEventWidget({ clientProfile, onOpenUpgradeModal }: UpcomingEventWidgetProps) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // FINAL FIX: Calling the corrected server action which no longer requires a userId.
    getUpcomingLiveEvent()
      .then(result => {
        if (result.success && result.data) {
          setEvent(result.data as any);
        } else if (result.error) {
            console.error("Server error fetching event:", result.error);
        }
      })
      .catch(err => console.error("Client error fetching live event:", err))
      .finally(() => setIsLoading(false));

  }, [clientProfile]); // Dependency retained to refetch if the user context changes.

  if (isLoading) {
    return (
        <Card>
            <CardContent className="flex justify-center items-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    );
  }

  // If no event is found, render nothing, as per the original requirement.
  if (!event) {
    return null;
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-4">
            <CalendarPlus className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-1">
                <p className="font-semibold leading-tight">{event.title}</p>
                <p className="text-sm text-muted-foreground leading-tight">
                    {new Date((event as any).start).toLocaleString([], { month: 'long', day: 'numeric' })}
                    &nbsp;&middot;&nbsp;Click to see more
                </p>
            </div>
        </CardContent>
      </Card>
      
      <AllEventsDialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        userProfile={null}
        clientProfile={clientProfile}
        onOpenUpgradeModal={onOpenUpgradeModal}
      />
    </>
  );
}
