'use client';

import { Workout } from '@/types/workout-program';
import { UserProfile } from '@/types';
import { WorkoutPlayer } from '@/components/workout-player/workout-player';

interface ActiveWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  userProfile: UserProfile | null;
  calendarEventId?: string;
  programId?: string;
}

export function ActiveWorkoutDialog({ 
  isOpen, 
  onClose, 
  workout, 
  userProfile, 
  calendarEventId, 
  programId 
}: ActiveWorkoutDialogProps) {

  return (
      <WorkoutPlayer
        isOpen={isOpen}
        onClose={onClose}
        workout={workout}
        userProfile={userProfile}
        calendarEventId={calendarEventId}
        programId={programId}
      />
  );
}
