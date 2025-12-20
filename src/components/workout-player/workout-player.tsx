'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Workout, ExerciseBlock, Set, RestBlock, Exercise } from '@/types/workout-program';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Clock, SkipForward, X, CheckCircle, Flame } from 'lucide-react';
import { useWorkoutEngine, WorkoutStatus } from '@/hooks/useWorkoutEngine';
import { formatTime, extractExerciseIds } from '@/lib/utils';
import { getExercisesByIdsAction } from '@/app/exercises/actions';

interface WorkoutPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    workout: Workout | null;
}

export function WorkoutPlayer({ isOpen, onClose, workout }: WorkoutPlayerProps) {
    const {
        status,
        currentBlock,
        nextBlock,
        currentSetIndex,
        timer,
        isTimerActive,
        workoutProgress,
        performanceData,
        startWorkout,
        completeSet,
        skipRest,
        endWorkout,
    } = useWorkoutEngine(workout);

    const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
    const [reps, setReps] = useState('');
    const [weight, setWeight] = useState('');

    useEffect(() => {
        const fetchExercises = async () => {
            if (!workout) return;
            const exerciseIds = extractExerciseIds(workout);
            if (exerciseIds.length > 0) {
                const result = await getExercisesByIdsAction(exerciseIds);
                if (result.success) {
                    setExercises(new Map(result.data.map(ex => [ex.id, ex])));
                }
            }
        };
        fetchExercises();
    }, [workout]);

    useEffect(() => {
        if (isOpen && workout && status === 'idle') {
            startWorkout();
        }
    }, [isOpen, workout, status, startWorkout]);
    
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
        const repsAsNum = parseInt(reps, 10);
        const weightAsNum = parseFloat(weight);
        if (!isNaN(repsAsNum)) {
            completeSet(repsAsNum, isNaN(weightAsNum) ? 0 : weightAsNum);
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'resting':
                return <RestView timer={timer} onSkip={skipRest} />;
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
                return <FinishedView onClose={onClose} workoutName={workout?.name || 'Workout'} />;
            default:
                return <p>Preparing your workout...</p>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="h-[90dvh] w-[95vw] max-w-md flex flex-col p-4 sm:p-6 bg-background text-foreground">
                <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <DialogTitle className="truncate pr-4 font-bold text-xl">{workout?.name}</DialogTitle>
                </DialogHeader>

                {/* This container no longer stretches, fixing the vertical space issue */}
                <div className="flex flex-col gap-4 py-4">
                    <WorkoutProgressBar progress={workoutProgress} />
                    <div className="flex flex-col items-center justify-center text-center bg-muted/30 dark:bg-muted/50 rounded-lg p-4">
                        {renderContent()}
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 mt-auto">
                   <p className="w-full text-center text-muted-foreground text-sm">Up Next: {upNextText}</p>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Sub-components for different states
const RestView = ({ timer, onSkip }: { timer: number, onSkip: () => void }) => (
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
        {/* This media placeholder no longer has flex-1, fixing the layout */}
        <div className="w-full aspect-video bg-gray-700 rounded-md my-4 flex items-center justify-center">
            {/* Future: IMG/Video component here */}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onComplete(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Placeholder text is now shortened to 'Tgt:' */}
                <Input type="number" value={reps} onChange={e => onRepsChange(e.target.value)} placeholder={`Tgt: ${set.value || '-'}`} className="text-center text-2xl h-16" />
                <Input type="number" value={weight} onChange={e => onWeightChange(e.target.value)} placeholder={`Tgt: ${set.weight || '-'}kg`} className="text-center text-2xl h-16" />
            </div>
            <Button size="lg" className="w-full h-14 text-xl">Complete Set</Button>
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
