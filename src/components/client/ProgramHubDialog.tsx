'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlayCircle, CalendarClock, Check, Eye, History } from 'lucide-react';
import { Program, Workout } from '@/types/workout-program';
import { getClientProfileAction, getProgramDetailsAction } from '@/app/client/actions';
import { getWorkoutsByIdsAction } from '@/app/workouts/actions';
import { createCalendarEventAction } from '@/app/calendar/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { WorkoutPlayer } from '@/components/workout-player/workout-player';
import { ProgramBrowserDialog } from './ProgramBrowserDialog';
import { WorkoutOverviewDialog } from './WorkoutOverviewDialog';
import { WorkoutHistoryDialog } from './WorkoutHistoryDialog';
import { FullWorkoutHistoryDialog } from './FullWorkoutHistoryDialog';

interface ProgramHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProgramHubDialog({ isOpen, onClose }: ProgramHubDialogProps) {
  const { userProfile } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [workouts, setWorkouts] = useState<Map<string, Workout>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [schedulingWorkoutId, setSchedulingWorkoutId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workoutToPlay, setWorkoutToPlay] = useState<Workout | null>(null);
  const [workoutToPreview, setWorkoutToPreview] = useState<Workout | null>(null);
  const [workoutToViewHistory, setWorkoutToViewHistory] = useState<Workout | null>(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isFullHistoryOpen, setIsFullHistoryOpen] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const loadHubData = async () => {
      if (!isOpen || isBrowserOpen || !userProfile?.uid) {
        return;
      }

      setIsLoading(true);
      setProgram(null);
      setWorkouts(new Map());

      const profileResult = await getClientProfileAction(userProfile.uid);
      const activeProgramId = profileResult.data?.activeProgramId;

      if (!profileResult.success || !activeProgramId) {
        setIsLoading(false);
        return;
      }

      try {
        const programResult = await getProgramDetailsAction(activeProgramId);
        if (!programResult.success || !programResult.data) {
          throw new Error(programResult.error || 'Failed to load program details');
        }

        const fetchedProgram = programResult.data;
        setProgram(fetchedProgram);

        const allWorkoutIds = fetchedProgram.weeks?.flatMap(week => week.workoutIds || []).filter(id => id) || [];
        if (allWorkoutIds.length > 0) {
          const workoutsResult = await getWorkoutsByIdsAction(allWorkoutIds);
          if (workoutsResult.success) {
            setWorkouts(new Map(workoutsResult.data.map(w => [w.id, w])));
          } else {
            throw new Error('Failed to load workouts for the program');
          }
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Loading Program', description: error.message });
        setProgram(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadHubData();
  }, [isOpen, isBrowserOpen, refetchTrigger, userProfile?.uid, toast]);

  const handleStartWorkout = (workout: Workout) => setWorkoutToPlay(workout);
  const handlePreviewWorkout = (workout: Workout) => setWorkoutToPreview(workout);
  const handleViewHistory = (workout: Workout) => setWorkoutToViewHistory(workout);
  const handlePlayerClose = () => setWorkoutToPlay(null);

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

    try {
      const result = await createCalendarEventAction({
        userId: userProfile.uid,
        programId: program?.id,
        workoutId: workout.id,
        startTime,
        duration: workout.duration || 60,
      });

      if (result.success) {
        toast({ title: "Workout Scheduled!", description: `Your workout is on the calendar.` });
        setSchedulingWorkoutId(null);
      } else {
        throw new Error((result as any).error || 'Failed to schedule workout');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Scheduling Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBrowserClose = (shouldRefetch?: boolean) => {
    setIsBrowserOpen(false);
    if (shouldRefetch) {
      setRefetchTrigger(v => v + 1);
    }
  };

  const mainDialogOpen = isOpen && !workoutToPlay && !isBrowserOpen && !workoutToPreview && !workoutToViewHistory && !isFullHistoryOpen;

  return (
    <>
      <Dialog open={mainDialogOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isLoading ? 'Loading Program...' : program?.name || 'Your Active Program'}</DialogTitle>
            <DialogDescription>
              {isLoading ? "Please wait..." : (program ? "Here is your weekly workout plan. Let's get started!" : "Select a program from the browser.")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-1 space-y-6">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className='ml-3 text-muted-foreground'>Loading your program...</p>
                </div>
            ) : program && program.weeks?.length > 0 ? (
                <div className="space-y-4">
                {program.weeks.map((week, weekIndex) => (
                    <div key={week.id || weekIndex}>
                        <h3 className='font-semibold text-lg mb-3 sticky top-0 bg-background py-2 border-b'>{week.name}</h3>
                        <div className="space-y-2 px-2">
                        {(week.workoutIds && week.workoutIds.length > 0) ? week.workoutIds.map((workoutId, index) => {
                            const workout = workouts.get(workoutId);
                            const uniqueId = `${week.id || weekIndex}-${workoutId}-${index}`;
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
                                    <div className='flex items-center gap-1'>
                                        <Button variant="ghost" size="icon" onClick={() => handleViewHistory(workout)} title="View Past Workouts">
                                            <History className="h-5 w-5 text-gray-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handlePreviewWorkout(workout)} title="Preview Workout">
                                            <Eye className="h-5 w-5 text-blue-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleStartWorkout(workout)} title="Start Workout">
                                            <PlayCircle className="h-5 w-5 text-green-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenScheduler(uniqueId)} title="Schedule Workout">
                                            <CalendarClock className="h-5 w-5 text-purple-500" />
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
                ))}
                </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">You do not have an active program.</p>
              <Button variant="link" onClick={() => setIsBrowserOpen(true)}>Browse programs to get started.</Button>
            </div>
          )}
        </div>

          <DialogFooter className="pt-4 border-t">
            <div className="flex flex-col w-full space-y-2">
                <Button variant="secondary" onClick={() => setIsFullHistoryOpen(true)}>View Full History</Button>
                <Button variant="outline" onClick={() => setIsBrowserOpen(true)}>Browse Other Programs</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgramBrowserDialog 
        isOpen={isBrowserOpen}
        onClose={handleBrowserClose}
        userProfile={userProfile}
      />

      {userProfile && (
        <FullWorkoutHistoryDialog 
            isOpen={isFullHistoryOpen}
            onClose={() => setIsFullHistoryOpen(false)}
            userProfile={userProfile}
        />
      )}

      {userProfile && (
        <WorkoutOverviewDialog
          isOpen={!!workoutToPreview}
          onClose={() => setWorkoutToPreview(null)}
          workout={workoutToPreview}
          userProfile={userProfile}
        />
      )}

    {userProfile && workoutToViewHistory && (
        <WorkoutHistoryDialog
            isOpen={!!workoutToViewHistory}
            onClose={() => setWorkoutToViewHistory(null)}
            workoutId={workoutToViewHistory.id}
            userId={userProfile.uid}
            workoutName={workoutToViewHistory.name}
        />
    )}

      {workoutToPlay && (
        <WorkoutPlayer 
            isOpen={!!workoutToPlay}
            onClose={handlePlayerClose}
            workout={workoutToPlay}
            userProfile={userProfile}
            programId={program?.id}
        />
      )}
    </>
  );
}
