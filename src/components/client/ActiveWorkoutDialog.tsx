'use client';

import { Workout } from '@/types/workout-program';
import { UserProfile } from '@/types';
import { WorkoutPlayer } from '@/components/workout-player/workout-player';

interface ActiveWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  userProfile: UserProfile | null;
}

export function ActiveWorkoutDialog({ isOpen, onClose, workout, userProfile }: ActiveWorkoutDialogProps) {
  if (!isOpen || !workout) {
    return null;
  }

  // This now correctly renders the interactive WorkoutPlayer
  return (
    <WorkoutPlayer
      isOpen={isOpen}
      onClose={onClose}
      workout={workout}
      userProfile={userProfile}
    />
  );
}
