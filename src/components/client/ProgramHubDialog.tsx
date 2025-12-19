'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlayCircle, CalendarClock, Check, X } from 'lucide-react';
import { Program, Workout, Exercise } from '@/types/workout-program';
import { UserProfile } from '@/types';
import { getProgramDetailsAction } from '@/app/client/actions';
import { getWorkoutsByIdsAction } from '@/app/workouts/actions';
import { getExercisesByIdsAction } from '@/app/exercises/actions';
import { useToast } from '@/hooks/use-toast';
import { ActiveWorkoutDialog } from './ActiveWorkoutDialog';
import { extractExerciseIds } from '@/lib/utils';

// TODO: Replace with your actual server action to create a calendar event.
async function scheduleWorkoutAction(data: { workoutId: string, workoutName: string, startTime: Date, duration: number, userId: string }) {
    console.log("Simulating call to schedule workout action with:", data);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!data.workoutName) {
        return { success: false, error: "Workout name cannot be empty." };
    }
    return { success: true, data: { ...data, id: `evt_${Math.random()}` } };
}

interface ProgramHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

export function ProgramHubDialog({ isOpen, onClose, userProfile }: ProgramHubDialogProps) {
  const [program, setProgram] = useState<Program | null>(null);
  const [workouts, setWorkouts] = useState<Map<string, Workout>>(new Map());
  const [exerciseDetails, setExerciseDetails] = useState<Map<string, Exercise>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [schedulingWorkoutId, setSchedulingWorkoutId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const { toast } = useToast();

  const fetchProgramData = useCallback(async () => {
    if (!userProfile?.activeProgramId || !userProfile.uid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      const programResult = await getProgramDetailsAction(userProfile.activeProgramId);
      if (programResult.success === false) throw new Error(programResult.error);
      const fetchedProgram = programResult.data;
      setProgram(fetchedProgram);

      const allWorkoutIds = fetchedProgram.weeks.flatMap((week: any) => 
          Array.isArray(week.workoutIds) ? week.workoutIds : (week.workoutId ? [week.workoutId] : [])
      ).filter((id: string) => id);

      if (allWorkoutIds.length > 0) {
        const workoutsResult = await getWorkoutsByIdsAction(allWorkoutIds);
        if (workoutsResult.success === false) throw new Error(workoutsResult.error);
        const fetchedWorkouts = workoutsResult.data;
        setWorkouts(new Map(fetchedWorkouts.map(w => [w.id, w])));

        const allExerciseIds = extractExerciseIds(fetchedWorkouts.flatMap(w => w.blocks));
        if (allExerciseIds.length > 0) {
          const exercisesResult = await getExercisesByIdsAction(allExerciseIds);
          if (exercisesResult.success) {
            setExerciseDetails(new Map(exercisesResult.data.map(e => [e.id, e])));
          }
        }
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Loading Program', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchProgramData();
    }
  }, [isOpen, fetchProgramData]);

  const handleStartWorkout = (workout: Workout) => {
    setActiveWorkout(workout);
  };

  const handleOpenScheduler = (uniqueId: string) => {
    setSchedulingWorkoutId(uniqueId);
    const today = new Date();
    setScheduleDate(today.toISOString().split('T')[0]);
    setScheduleTime('09:00');
  };

 const handleConfirmSchedule = async (workout: Workout) => {
    if (!scheduleDate || !scheduleTime || !userProfile) {
        toast({ variant: 'destructive', title: 'Missing Details', description: "Please select both a date and a time." });
        return;
    }
    setIsSubmitting(true);
    const startTime = new Date(`${scheduleDate}T${scheduleTime}`);
    
    const result = await scheduleWorkoutAction({
        workoutId: workout.id,
        workoutName: workout.name,
        startTime,
        duration: workout.duration || 60, 
        userId: userProfile.uid
    });

    setIsSubmitting(false);
    if (result.success) {
        toast({ title: "Workout Scheduled!", description: `"${workout.name}" is on your calendar.` });
        setSchedulingWorkoutId(null);
    } else {
        toast({ variant: 'destructive', title: 'Scheduling Failed', description: result.error });
    }
  };

  return (
    <>
      <Dialog open={isOpen && !activeWorkout} onOpenChange={(open) => { if (!open) onClose(); }}>
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
                                            <Button size="sm" onClick={() => handleConfirmSchedule(workout)} disabled={isSubmitting}>
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

      <ActiveWorkoutDialog 
        isOpen={!!activeWorkout}
        onClose={() => setActiveWorkout(null)}
        workout={activeWorkout}
        exerciseDetails={exerciseDetails}
      />
    </>
  );
}
