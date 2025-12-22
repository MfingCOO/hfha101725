'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Workout, ExerciseBlock, RestBlock, Exercise } from '@/types/workout-program';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Clock, SkipForward, X, CheckCircle } from 'lucide-react';
import { useWorkoutEngine } from '@/hooks/useWorkoutEngine';
import { formatTime, extractExerciseIds } from '@/lib/utils';
import { getExercisesByIdsAction } from '@/app/exercises/actions';
import { completeWorkoutAction } from '@/app/calendar/actions';
import { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface WorkoutPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    workout: Workout | null;
    userProfile: UserProfile | null;
    calendarEventId?: string;
    programId?: string; 
}

export function WorkoutPlayer({ isOpen, onClose, workout, userProfile, calendarEventId, programId }: WorkoutPlayerProps) {
    const { toast } = useToast();
    const {
        status,
        currentBlock,
        nextBlock,
        currentSetIndex,
        timer,
        workoutProgress,
        startWorkout,
        completeSet,
        skipRest,
    } = useWorkoutEngine(workout);

    const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
    const [reps, setReps] = useState('');
    const [weight, setWeight] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);

    useEffect(() => {
        if (!workout) return;
        const fetchExercises = async () => {
            const exerciseIds = extractExerciseIds(workout);
            if (exerciseIds.length > 0) {
                const result = await getExercisesByIdsAction(exerciseIds);
                if (result.success) {
                    setExercises(new Map(result.data.map(ex => [ex.id, ex])));
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load exercise details.' });
                }
            }
        };
        fetchExercises();
    }, [workout, toast]);

    useEffect(() => {
        if (isOpen && workout && status === 'idle') {
            setStartTime(new Date());
            startWorkout();
        }
    }, [isOpen, workout, status, startWorkout]);

    const handleWorkoutCompletion = useCallback(async () => {
        if (!workout || !userProfile || !startTime) return;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneOffset = new Date().getTimezoneOffset();

        const result = await completeWorkoutAction({
            userId: userProfile.uid,
            workoutId: workout.id,
            startTime: startTime,
            duration: workout.duration || 60, 
            programId,
            calendarEventId,
            timezone, 
            timezoneOffset,
        });

        if (result.success === false) {
            toast({ variant: 'destructive', title: 'Logging Failed', description: result.error || 'Could not save workout progress.' });
        } else {
            toast({ title: 'Workout Complete!', description: 'Great job! Your progress has been saved.' });
        }
        onClose();
    }, [workout, userProfile, startTime, toast, calendarEventId, programId, onClose]);

    
    useEffect(() => {
        if (status === 'finished') {
            handleWorkoutCompletion();
        }
    }, [status, handleWorkoutCompletion]);
    
    const currentExerciseBlock = useMemo(() => 
        currentBlock?.type === 'exercise' ? (currentBlock as ExerciseBlock) : null, 
    [currentBlock]);

    const currentExercise = useMemo(() => 
        currentExerciseBlock ? exercises.get(currentExerciseBlock.exerciseId) : null, 
    [currentExerciseBlock, exercises]);
    
    const currentSet = useMemo(() => 
        currentExerciseBlock ? currentExerciseBlock.sets[currentSetIndex] : null, 
    [currentExerciseBlock, currentSetIndex]);

    const upNextText = useMemo(() => {
        if (!nextBlock) return "Nothing. You're all done!";
        if (nextBlock.type === 'rest') return `Rest: ${nextBlock.duration}s`;
        if (nextBlock.type === 'exercise'){
            const nextExercise = exercises.get(nextBlock.exerciseId);
            return nextExercise?.name || "Next exercise";
        }
        return "Get ready!";
    }, [nextBlock, exercises]); 

    useEffect(() => {
        if (currentSet) {
            setReps(String(currentSet.value || ''));
            setWeight(String(currentSet.weight || ''));
        }
    }, [currentSet]);

    const handleCompleteSet = () => {
        if (!currentExerciseBlock) return;
        const repsAsNum = parseInt(reps, 10);
        const weightAsNum = parseFloat(weight);
        if (!isNaN(repsAsNum)) {
            completeSet(repsAsNum, isNaN(weightAsNum) ? undefined : weightAsNum);
        }
    };

    const renderContent = () => {
        if (!workout) return <p>Loading workout...</p>;
        switch (status) {
            case 'resting':
                const restBlock = currentBlock as RestBlock;
                return <RestView timer={timer} onSkip={skipRest} duration={restBlock.duration} />;
            case 'exercising':
                if (!currentExercise || !currentSet) return <p>Loading exercise...</p>;
                return (
                    <ExerciseView 
                        exercise={currentExercise}
                        set={currentSet}
                        setIndex={currentSetIndex}
                        totalSets={currentExerciseBlock?.sets.length || 0}
                        reps={reps}
                        weight={weight}
                        onRepsChange={setReps}
                        onWeightChange={setWeight}
                        onComplete={handleCompleteSet}
                    />
                );
            case 'finished':
                return <FinishedView onClose={onClose} workoutName={workout.name} />;
            default:
                return <p>Preparing your workout...</p>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full h-full max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>{workout?.name || 'Workout'}</DialogTitle>
                    <VisuallyHidden>
                        <DialogDescription>An interactive player to guide you through your workout, set by set.</DialogDescription>
                    </VisuallyHidden>
                </DialogHeader>
                
                <div className="flex-shrink-0 flex flex-row items-center justify-between sr-only">
                    <h2 className="truncate pr-4 font-bold text-xl">{workout?.name || 'Workout'}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5"/></Button>
                </div>

                <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
                    <WorkoutProgressBar progress={workoutProgress} />
                    <div className="flex flex-col items-center justify-center text-center bg-muted/30 dark:bg-muted/50 rounded-lg p-4 min-h-[300px]">
                        {renderContent()}
                    </div>
                </div>

                <div className="flex-shrink-0 border-t p-4">
                    <p className="w-full text-center text-muted-foreground text-sm">Up Next: {upNextText}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Sub-components for different states
const RestView = ({ timer, onSkip, duration }: { timer: number, onSkip: () => void, duration: number }) => (
    <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-3xl font-medium text-muted-foreground mb-4">REST</p>
        <h2 className="text-8xl font-bold font-mono tracking-tighter mb-8">{formatTime(timer)}</h2>
        <Button size="lg" variant="secondary" onClick={onSkip}>
            <SkipForward className="mr-2 h-5 w-5"/>
            Skip Rest
        </Button>
    </div>
);

const ExerciseView = ({ exercise, set, setIndex, totalSets, reps, weight, onRepsChange, onWeightChange, onComplete }: any) => (
    <div className="w-full h-full flex flex-col">
        <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold truncate">{exercise.name}</h2>
            <p className="text-xl text-muted-foreground">Set {setIndex + 1} of {totalSets}</p>
        </div>
        
        {exercise.mediaUrl && (
            <div className="w-full aspect-video bg-gray-900 rounded-md my-4 overflow-hidden">
                 <iframe
                    className="w-full h-full"
                    src={exercise.mediaUrl.replace("watch?v=", "embed/")}
                    title="Exercise video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); onComplete(); }} className="space-y-4 mt-auto">
            <div className="grid grid-cols-5 gap-3">
                <div className='col-span-2'>
                    <label className='text-xs text-muted-foreground ml-1'>Reps</label>
                    <Input 
                        type="number" 
                        value={reps} 
                        onChange={e => onRepsChange(e.target.value)} 
                        placeholder={`${set.value || '-'}`}
                        className="text-center text-2xl h-16 w-full"
                    />
                </div>
                <div className='col-span-3'>
                    <label className='text-xs text-muted-foreground ml-1'>Weight (kg)</label>
                     <Input 
                        type="number" 
                        value={weight} 
                        onChange={e => onWeightChange(e.target.value)} 
                        placeholder={`${set.weight || '-'}`}
                        className="text-center text-2xl h-16 w-full"
                    />
                </div>
            </div>
            <Button size="lg" className="w-full h-14 text-xl font-bold">
                <CheckCircle className="mr-3 h-6 w-6" />
                Complete Set
            </Button>
        </form>
    </div>
);

const FinishedView = ({ onClose, workoutName }: { onClose: () => void, workoutName: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <CheckCircle className="h-20 w-20 text-green-500 mb-6" />
        <h2 className="text-4xl font-bold mb-2">Workout Complete!</h2>
        <p className="text-lg text-muted-foreground mb-8">You crushed the <span className='font-semibold'>{workoutName}</span> workout.</p>
        <Button size="lg" onClick={onClose}>Done</Button>
    </div>
);

const WorkoutProgressBar = ({ progress }: { progress: number }) => (
    <div>
        <Progress value={progress} className="w-full h-2" />
        <p className="text-sm text-muted-foreground mt-1 text-center">{Math.round(progress)}% Complete</p>
    </div>
);
