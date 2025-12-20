'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlayCircle, CalendarClock, Check } from 'lucide-react';
import { Program, Workout } from '@/types/workout-program';
import { UserProfile } from '@/types';
import { getProgramDetailsAction } from '@/app/client/actions';
import { createCalendarEventAction } from '@/app/calendar/actions';
import { getWorkoutsByIdsAction } from '@/app/workouts/actions';
import { useToast } from '@/hooks/use-toast';
import { WorkoutPlayer } from '@/components/workout-player/workout-player';

interface ProgramHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

export function ProgramHubDialog({ isOpen, onClose, userProfile }: ProgramHubDialogProps) {
  const [program, setProgram] = useState<Program | null>(null);
  const [workouts, setWorkouts] = useState<Map<string, Workout>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [schedulingWorkoutId, setSchedulingWorkoutId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workoutToPlay, setWorkoutToPlay] = useState<Workout | null>(null);
  const { toast } = useToast();

  const fetchProgramData = useCallback(async () => {
    if (!userProfile?.activeProgramId || !userProfile.uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const programResult = await getProgramDetailsAction(userProfile.activeProgramId);

    if ('error' in programResult && programResult.error) {
      toast({ variant: 'destructive', title: 'Error Loading Program', description: String(programResult.error) });
    } else if ('data' in programResult) {
      const fetchedProgram = programResult.data;
      setProgram(fetchedProgram);

      const allWorkoutIds = fetchedProgram.weeks.flatMap((week: any) =>
        Array.isArray(week.workoutIds) ? week.workoutIds : (week.workoutId ? [week.workoutId] : [])
      ).filter((id: string) => id);

      if (allWorkoutIds.length > 0) {
        const workoutsResult = await getWorkoutsByIdsAction(allWorkoutIds);
        if ('error' in workoutsResult && workoutsResult.error) {
          toast({ variant: 'destructive', title: 'Error Loading Workouts', description: String(workoutsResult.error) });
        } else if ('data' in workoutsResult) {
          const fetchedWorkouts = workoutsResult.data;
          setWorkouts(new Map(fetchedWorkouts.map(w => [w.id, w])));
        }
      }
    }

    setIsLoading(false);
  }, [userProfile, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchProgramData();
    }
  }, [isOpen, fetchProgramData]);

  const handleStartWorkout = (workout: Workout) => {
    setWorkoutToPlay(workout);
  };
  
  const handlePlayerClose = () => {
      setWorkoutToPlay(null);
  };

  const handleOpenScheduler = (uniqueId: string) => {
    setSchedulingWorkoutId(uniqueId);
    const today = new Date();
    setScheduleDate(today.toISOString().split('T')[0]);
    setScheduleTime('09:00');
  };

  const handleConfirmSchedule = async (workout: Workout, weekName: string, dayIndex: number) => {
    if (!scheduleDate || !scheduleTime || !userProfile) {
      toast({ variant: 'destructive', title: 'Missing Details', description: "Please select both a date and a time." });
      return;
    }
    setIsSubmitting(true);
    const startTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const newTitle = `${weekName}, Day ${dayIndex + 1}: ${workout.name}`;

    const result = await createCalendarEventAction({
      userId: userProfile.uid,
      workoutId: workout.id,
      workoutName: newTitle, // We are now using the new, more descriptive title
      startTime,
      duration: workout.duration || 60,
    });

    if ('error' in result && result.error) {
      toast({ variant: 'destructive', title: 'Scheduling Failed', description: String(result.error) });
    } else {
      toast({ title: "Workout Scheduled!", description: `"${newTitle}" is on your calendar.` });
      setSchedulingWorkoutId(null);
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Dialog open={isOpen && !workoutToPlay} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isLoading ? 'Loading Program...' : program?.name || 'Your Active Program'}</DialogTitle>
            <DialogDescription>
              {isLoading ? "Please wait..." : "Here is your weekly workout plan. Let's get started!"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-1 space-y-6">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className='ml-3 text-muted-foreground'>Loading your program...</p>
                </div>
            ) : program ? (
                <div className="space-y-4">
                {program.weeks.map((week: any) => {
                    const workoutIds = Array.isArray(week.workoutIds) ? week.workoutIds : (week.workoutId ? [week.workoutId] : []);
                    return (
                    <div key={week.id}>
                        <h3 className='font-semibold text-lg mb-3 sticky top-0 bg-background py-2 border-b'>{week.name}</h3>
                        <div className="space-y-2 px-2">
                        {workoutIds.length > 0 ? workoutIds.map((workoutId: string, index: number) => {
                            const workout = workouts.get(workoutId);
                            const uniqueId = `${workoutId}-${index}`;
                            const isScheduling = schedulingWorkoutId === uniqueId;

                            if (!workout) return (
                            <div key={uniqueId} className='text-sm text-muted-foreground'>
                                Day {index + 1}: Could not load workout details.
                            </div>
                            );
                            
                            return (
                            <div key={uniqueId} className='p-3 bg-muted/50 rounded-lg'>
                                <div className='flex justify-between items-center'>
                                <span className='font-medium'>{`Day ${index + 1}: ${workout.name}`}</span>
                                {!isScheduling && (
                                    <div className='flex items-center gap-2'>
                                    <Button variant="ghost" size="icon" onClick={() => handleStartWorkout(workout)} title="Start Workout">
                                        <PlayCircle className="h-5 w-5 text-green-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenScheduler(uniqueId)} title="Schedule Workout">
                                        <CalendarClock className="h-5 w-5 text-blue-500" />
                                    </Button>
                                    </div>
                                )}
                                </div>
                                {isScheduling && (
                                    <div className="mt-4 space-y-3">
                                        <div className='flex gap-2'>
                                            <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-1/2"/>
                                            <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-1/2"/>
                                        </div>
                                        <div className='flex justify-end gap-2'>
                                            <Button variant="ghost" size="sm" onClick={() => setSchedulingWorkoutId(null)} disabled={isSubmitting}>Cancel</Button>
                                            <Button size="sm" onClick={() => handleConfirmSchedule(workout, week.name, index)} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 mr-2"/>}
                                                Confirm
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            );
                        }) : <p className="text-sm text-muted-foreground p-4 text-center">No workouts assigned for this week.</p>}
                        </div>
                    </div>
                )})
                }
                </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">You do not have an active program.</p>
            </div>
          )}
        </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => { /* Implement browse logic */ }}>Browse Other Programs</Button>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {workoutToPlay && (
        <WorkoutPlayer 
            isOpen={!!workoutToPlay}
            onClose={handlePlayerClose}
            workout={workoutToPlay}
            userProfile={userProfile}
        />
      )}
    </>
  );
}
