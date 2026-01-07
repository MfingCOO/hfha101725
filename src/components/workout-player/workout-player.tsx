'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { completeWorkoutAction } from '@/app/calendar/actions';
import { Workout, ExerciseBlock, Exercise, Set, PerformanceLog } from '@/types/workout-program';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle, Play, Pause, SkipForward } from 'lucide-react';
import { useWorkoutEngine } from '@/hooks/use-workout-engine';
import { formatTime, extractExerciseIds } from '@/lib/utils';
import { getExercisesByIdsAction } from '@/app/exercises/actions';
import { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { RPE_SCALE } from '@/lib/rpe-scale';

const KG_TO_LBS = 2.20462;
const convertKgToLbs = (kg: number) => Math.round((kg * KG_TO_LBS) * 2) / 2;
const convertLbsToKg = (lbs: number) => lbs / KG_TO_LBS;

interface WorkoutPlayerProps {
    isOpen: boolean;
    onClose: () => void;
    workout: Workout | null;
    userProfile: UserProfile | null;
    programId?: string;
    calendarEventId?: string;
}

export function WorkoutPlayer({ isOpen, onClose, workout, userProfile, programId, calendarEventId }: WorkoutPlayerProps) {
    const { toast } = useToast();
    const engine = useWorkoutEngine(workout);
    const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleClose = useCallback(() => {
        if (engine.status !== 'finished') {
            engine.endWorkout();
        }
        onClose();
    }, [engine.status, engine.endWorkout, onClose]);

    useEffect(() => {
        if (isOpen && workout && engine.status === 'idle') {
            engine.startWorkout();
        }
    }, [isOpen, workout, engine.status, engine.startWorkout]);

    useEffect(() => {
        const completeAndLogWorkout = async () => {
            if (engine.status === 'finished' && workout && userProfile && !isSubmitting) {
                setIsSubmitting(true);

                const performanceLog: PerformanceLog = {
                    userId: userProfile.uid,
                    workoutId: workout.id,
                    programId: programId || null,
                    completedAt: new Date(),
                    duration: engine.elapsedTime,
                    performance: engine.performanceData,
                };

                const result = await completeWorkoutAction({
                    userId: userProfile.uid,
                    workoutId: workout.id,
                    startTime: engine.startTime ? new Date(engine.startTime) : new Date(),
                    duration: workout.duration, // THIS IS THE FIX: Use the coach's planned duration
                    performanceLog: performanceLog,
                    programId: programId,
                    calendarEventId: calendarEventId,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    timezoneOffset: new Date().getTimezoneOffset(),
                });

                if (result.success) {
                    toast({ title: 'Workout Complete!', description: 'Great job! Your performance has been logged.' });
                } else {
                    toast({ variant: 'destructive', title: 'Logging Failed', description: result.error || 'Could not save your workout performance.' });
                }
                setTimeout(handleClose, 1000);
            }
        };

        completeAndLogWorkout();
    }, [engine.status, engine.elapsedTime, engine.performanceData, engine.startTime, workout, userProfile, programId, calendarEventId, isSubmitting, handleClose, toast]);

    const currentExerciseBlock = useMemo(() => engine.currentBlock?.type === 'exercise' ? (engine.currentBlock as ExerciseBlock) : null, [engine.currentBlock]);
    const currentExercise = useMemo(() => currentExerciseBlock ? exercises.get(currentExerciseBlock.exerciseId) : null, [currentExerciseBlock, exercises]);

    const renderContent = () => {
        if (!workout || !userProfile) return <p>Loading workout...</p>;
        switch (engine.status) {
            case 'resting': return <RestView timer={engine.timer} onSkip={engine.skipRest} />;
            case 'exercising':
                if (!currentExercise) return <p>Loading exercise...</p>;
                return <TimedExerciseView exercise={currentExercise} timer={engine.timer} />;
            case 'rep_based_pause':
                if (!currentExercise || !engine.currentSet) return <p>Loading exercise...</p>;
                return <RepBasedView exercise={currentExercise} set={engine.currentSet} onComplete={engine.completeSet} unitSystem={userProfile.unitSystem || 'metric'} />;
            case 'paused': return <PausedView onResume={engine.resumeWorkout} />;
            case 'finished': return <FinishedView workoutName={workout.name} />;
            default: return <p>Preparing your workout...</p>;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="max-w-md w-full h-full max-h-[95vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b flex-row items-center justify-between">
                    <DialogTitle className="truncate">{workout?.name || 'Workout'}</DialogTitle>
                    <div className="flex items-center space-x-2">
                        {engine.status !== 'idle' && engine.status !== 'finished' && (
                            engine.status === 'paused' ? (
                                <Button variant="ghost" size="icon" onClick={engine.resumeWorkout}><Play className="h-5 w-5"/></Button>
                            ) : (
                                <Button variant="ghost" size="icon" onClick={engine.pauseWorkout}><Pause className="h-5 w-5"/></Button>
                            )
                        )}
                    </div>
                </DialogHeader>
                <DialogDescription className="sr-only">An interactive player to guide you through your workout, set by set.</DialogDescription>

                <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
                    <WorkoutProgressBar progress={engine.workoutProgress} />
                    <div className="flex flex-col items-center justify-center text-center bg-muted/30 dark:bg-muted/50 rounded-lg p-4 flex-1 min-h-0">
                        {renderContent()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const RestView = ({ timer, onSkip }: { timer: number, onSkip: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-3xl font-medium text-muted-foreground mb-4">REST</p>
        <h2 className="text-8xl font-bold font-mono tracking-tighter mb-8">{formatTime(timer)}</h2>
        <Button onClick={onSkip} variant="ghost">
            <SkipForward className="mr-2 h-4 w-4" />
            Skip Rest
        </Button>
    </div>
);

const TimedExerciseView = ({ exercise, timer }: { exercise: Exercise, timer: number }) => (
    <div className="flex flex-col items-center justify-center h-full w-full">
        <h2 className="text-3xl sm:text-4xl font-bold truncate w-full mb-2">{exercise.name}</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-4">{exercise.description}</p>
        <h2 className="text-8xl font-bold font-mono tracking-tighter">{formatTime(timer)}</h2>
    </div>
);

const performanceLogSchema = z.object({
  reps: z.preprocess((val) => parseInt(String(val), 10), z.number().min(0, "Reps must be positive")),
  weight: z.preprocess((val) => parseFloat(String(val)), z.number().min(0, "Weight must be positive")),
});

type PerformanceLogValues = z.infer<typeof performanceLogSchema>;

const RepBasedView = ({ exercise, set, onComplete, unitSystem }: { exercise: Exercise, set: Set, onComplete: (log: PerformanceLogValues) => void, unitSystem: 'metric' | 'imperial' }) => {
    const form = useForm<PerformanceLogValues>({
        resolver: zodResolver(performanceLogSchema),
        defaultValues: {
            reps: parseInt(set.value || '0', 10) || 0,
            weight: (unitSystem === 'imperial' 
                ? convertKgToLbs(parseFloat(String(set.weight || 0)))
                : parseFloat(String(set.weight || 0))) || 0,
        }
    });

    useEffect(() => {
        const defaultWeightKg = parseFloat(String(set.weight || 0));
        const displayWeight = unitSystem === 'imperial' ? convertKgToLbs(defaultWeightKg) : defaultWeightKg;
        const targetReps = parseInt(set.value || '0', 10);
        form.reset({ reps: targetReps || 0, weight: displayWeight || 0 });
    }, [set, unitSystem, form]);

    const onSubmit = (data: PerformanceLogValues) => {
        const weightInKg = unitSystem === 'imperial' ? convertLbsToKg(data.weight) : data.weight;
        onComplete({ ...data, weight: weightInKg });
    };

    const rpeInfo = RPE_SCALE.find(r => r.value === set.rpe);
    const rpeDescription = rpeInfo ? (rpeInfo.lifting) : 'No RPE specified';

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col items-center justify-between h-full w-full space-y-3">
                <div className="text-center w-full">
                    <h2 className="text-2xl sm:text-3xl font-bold truncate">{exercise.name}</h2>
                    <div className="text-base space-y-1 bg-background/50 p-3 rounded-md mt-2">
                         <p><span className="font-semibold">Target:</span> {set.value} {set.metric}</p>
                         {set.rpe && <p className="text-sm text-muted-foreground"><span className="font-semibold">RPE {set.rpe}:</span> {rpeDescription}</p>}
                    </div>
                </div>
                <div className="w-full max-w-sm p-2">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="reps" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm">Actual Reps</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} value={field.value || ''} className="h-12 text-center text-xl" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="weight" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm">Weight ({unitSystem === 'imperial' ? 'lbs' : 'kg'})</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.5" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} value={field.value || ''} className="h-12 text-center text-xl" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>
                <Button type="submit" size="lg" className="h-14 text-xl font-bold w-full max-w-sm">
                    <CheckCircle className="mr-3 h-6 w-6" />
                    Complete Set
                </Button>
            </form>
        </FormProvider>
    );
};

const PausedView = ({ onResume }: { onResume: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
        <h2 className="text-4xl font-bold">Workout Paused</h2>
        <Button size="lg" onClick={onResume} className="h-14 text-xl font-bold">
            <Play className="mr-3 h-6 w-6" />
            Resume
        </Button>
    </div>
);

const FinishedView = ({ workoutName }: { workoutName: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <CheckCircle className="h-20 w-20 text-green-500 mb-6" />
        <h2 className="text-4xl font-bold mb-2">Workout Complete!</h2>
        <p className="text-lg text-muted-foreground mb-8">You crushed the <span className='font-semibold'>{workoutName}</span> workout.</p>
        <p className='text-sm text-muted-foreground'>Your performance is being logged.</p>
    </div>
);

const WorkoutProgressBar = ({ progress }: { progress: number }) => (
    <div className="px-4">
        <Progress value={progress} className="w-full h-2" />
        <p className="text-sm text-muted-foreground mt-1 text-center">{Math.round(progress)}% Complete</p>
    </div>
);
