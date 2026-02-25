'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Workout } from "@/types/workout-program";
import { PlayCircle, Eye } from 'lucide-react';

interface WorkoutSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  onStart: (workout: Workout) => void;
  onPreview: (workout: Workout) => void;
}

export function WorkoutSelectionDialog({ isOpen, onClose, workout, onStart, onPreview }: WorkoutSelectionDialogProps) {
  if (!workout) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start or Preview Workout?</DialogTitle>
          <DialogDescription>
            You have selected "{workout.name}".
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button onClick={() => onPreview(workout)} variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button onClick={() => onStart(workout)}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Start Workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
