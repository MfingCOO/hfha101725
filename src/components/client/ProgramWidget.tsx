'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, ArrowRight } from 'lucide-react';
import { ClientProfile } from '@/types';

interface ProgramWidgetProps {
  // Removed UserProfile as we are using the clients collection (ClientProfile)
  clientProfile: ClientProfile | null;
  onOpenProgramList: () => void;
  onOpenCurrentProgram: () => void;
}

export function ProgramWidget({ 
    clientProfile,
    onOpenProgramList,
    onOpenCurrentProgram 
}: ProgramWidgetProps) {

  // Check if the client document has an active program ID assigned
  const hasActiveProgram = !!clientProfile?.activeProgramId;

  const handleClick = () => {
    if (hasActiveProgram) {
      onOpenCurrentProgram();
    } else {
      onOpenProgramList();
    }
  };

  return (
    <Card 
        className="bg-secondary/50 border-border/30 hover:bg-secondary/70 transition-colors cursor-pointer"
        onClick={handleClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="bg-background/50 p-2 rounded-lg">
          <Dumbbell className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
            <p className="font-semibold leading-tight text-foreground">
                {hasActiveProgram ? "View Current Program" : "Program List"}
            </p>
            <p className="text-sm text-muted-foreground leading-tight">
                {hasActiveProgram ? "Check your workout for the day." : "Browse and subscribe to a workout program."}
            </p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowRight className="h-5 w-5" />
        </Button>
      </CardContent>
    </Card>
  );
}