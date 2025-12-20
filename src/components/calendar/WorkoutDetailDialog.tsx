'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getWorkoutByIdAction } from '@/app/workouts/actions';
import { getExercisesByIdsAction } from '@/app/exercises/actions';
import { Workout, Exercise, WorkoutBlock, GroupBlock } from '@/types/workout-program';
import { ScheduledEvent } from '@/types/event';
import { ActiveWorkoutDialog } from '@/components/client/ActiveWorkoutDialog';
import { extractExerciseIds } from '@/lib/utils';
import { format } from 'date-fns';

interface WorkoutDetailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    event: ScheduledEvent | null;
}

export function WorkoutDetailDialog({ isOpen, onClose, event }: WorkoutDetailDialogProps) {
    const { toast } = useToast();
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [exerciseDetails, setExerciseDetails] = useState<Map<string, Exercise>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [isStartingWorkout, setIsStartingWorkout] = useState(false);

    useEffect(() => {
        const fetchWorkoutDetails = async () => {
            if (!event || !event.relatedId) return;
            setIsLoading(true);
            try {
                const workoutResult = await getWorkoutByIdAction(event.relatedId);
                if ('error' in workoutResult) {
                    toast({ variant: 'destructive', title: 'Error loading workout', description: workoutResult.error });
                    onClose();
                } else {
                    setWorkout(workoutResult.data);
                }
            } catch (error) {
                console.error("Unexpected error in fetchWorkoutDetails:", error);
                toast({ variant: 'destructive', title: 'Unexpected Error', description: 'An unknown error occurred.' });
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchWorkoutDetails();
        }
    }, [isOpen, event, toast, onClose]);

    const handleStartWorkout = async () => {
        if (!workout) return;
        setIsStartingWorkout(true);
        try {
            const exerciseIds = extractExerciseIds(workout);
            if (exerciseIds.length > 0) {
                const exercisesResult = await getExercisesByIdsAction(exerciseIds);
                if ('error' in exercisesResult) {
                    toast({ variant: 'destructive', title: 'Error loading exercises', description: exercisesResult.error });
                    setIsStartingWorkout(false);
                } else {
                    setExerciseDetails(new Map(exercisesResult.data.map(e => [e.id, e])));
                }
            }
        } catch (error) {
            console.error("Unexpected error in handleStartWorkout:", error);
            toast({ variant: 'destructive', title: 'Unexpected Error', description: 'An unknown error occurred while starting the workout.' });
            setIsStartingWorkout(false);
        }
    };

    const getBlockTitle = (block: WorkoutBlock): string => {
        if (block.type === 'group') {
            return (block as GroupBlock).name;
        }
        if (block.type === 'exercise') {
            return 'Exercise';
        }
        if (block.type === 'rest') {
            return `Rest - ${block.duration} seconds`;
        }
        return 'Unknown Block';
    };

    if (!event) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); setWorkout(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{event.title}</DialogTitle>
                    </DialogHeader>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : workout ? (
                        <div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Scheduled for {format(new Date(event.startTime), 'h:mm a')}
                            </p>
                            <div className="space-y-2 mb-6">
                                <h4 className="font-semibold">Workout Overview:</h4>
                                <ul className="list-disc list-inside text-sm">
                                    {workout.blocks.map(block => (
                                        <li key={block.id}>{getBlockTitle(block)}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <p>Could not load workout details.</p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                        <Button onClick={handleStartWorkout} disabled={isLoading || isStartingWorkout || !workout}>
                            {isStartingWorkout ? <Loader2 className='h-4 w-4 animate-spin'/> : <PlayCircle className='h-4 w-4 mr-2'/>}
                            Start Workout
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {workout && isStartingWorkout && (
                <ActiveWorkoutDialog
                    isOpen={isStartingWorkout}
                    onClose={() => {
                        setIsStartingWorkout(false);
                        onClose();
                    }}
                    workout={workout}
                    exerciseDetails={exerciseDetails}
                />
            )}
        </>
    );
}
