'use client';

import { useState } from 'react';
import { AllEventsDialog } from './AllEventsDialog';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarPlus } from 'lucide-react';
import type { ClientProfile } from '@/types';

interface UpcomingEventWidgetProps {
  clientProfile: ClientProfile | null;
  onOpenUpgradeModal: () => void;
}

export function UpcomingEventWidget({ clientProfile, onOpenUpgradeModal }: UpcomingEventWidgetProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <CalendarPlus className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold leading-tight">Live Event/Workout Sign Up</p>
            <p className="text-sm text-muted-foreground leading-tight">Click to see more</p>
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