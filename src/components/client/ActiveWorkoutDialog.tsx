'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Workout, Exercise } from '@/types/workout-program';
import { WorkoutBlockDisplay } from './WorkoutBlockDisplay';
import { Clock, Zap } from 'lucide-react';

interface ActiveWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  exerciseDetails: Map<string, Exercise>;
}

export function ActiveWorkoutDialog({ isOpen, onClose, workout, exerciseDetails }: ActiveWorkoutDialogProps) {
  if (!workout) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Zap className="h-6 w-6 mr-3 text-yellow-500" />
            {workout.name}
          </DialogTitle>
          <DialogDescription className="pt-1">
            {workout.description}
             {workout.duration && (
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                    <Clock className="h-3 w-3 mr-1.5" />
                    <span>Estimated Duration: {workout.duration} minutes</span>
                </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1 space-y-3">
            {workout.blocks.map((block) => (
                <WorkoutBlockDisplay key={block.id} block={block} exerciseDetails={exerciseDetails} />
            ))}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button onClick={onClose} className="w-full" size="lg">
            Finish Workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
