'use client';

import { useState, useEffect } from 'react';
import { getUpcomingLiveEvent } from '@/app/coach/events/actions';
import { AllEventsDialog } from './AllEventsDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarPlus } from 'lucide-react';
import type { LiveEvent, UserProfile, ClientProfile } from '@/types';

interface UpcomingEventWidgetProps {
  userProfile: UserProfile | null;
  clientProfile: ClientProfile | null;
  onOpenUpgradeModal: () => void;
}

export function UpcomingEventWidget({ userProfile, clientProfile, onOpenUpgradeModal }: UpcomingEventWidgetProps) {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    getUpcomingLiveEvent()
      .then(result => {
        if (result.success && result.data) {
          const eventTime = new Date(result.data.eventTimestamp).getTime();
          const twelveHours = 12 * 60 * 60 * 1000;
          if (eventTime - Date.now() > twelveHours) {
            setEvent(result.data);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
        <Card>
            <CardContent className="flex justify-center items-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    );
}

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
                    {new Date(event.eventTimestamp).toLocaleString([], { month: 'long', day: 'numeric' })}
                    &nbsp;&middot;&nbsp;Click to see more
                </p>
            </div>
        </CardContent>
      </Card>
      
      <AllEventsDialog 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        userProfile={userProfile}
        clientProfile={clientProfile}
        onOpenUpgradeModal={onOpenUpgradeModal}
      />
    </>
  );
}
