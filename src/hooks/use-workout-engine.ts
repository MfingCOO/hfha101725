'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Workout, WorkoutBlock, ExerciseBlock, RestBlock, Set, PerformanceLog } from '@/types/workout-program';
import { logWorkoutPerformanceAction } from '@/app/workouts/actions';

type WorkoutStatus = 'idle' | 'exercising' | 'resting' | 'paused' | 'rep_based_pause' | 'finished';

export function useWorkoutEngine(workout: Workout | null, userId: string | undefined, programId: string | undefined) {
    const [status, setStatus] = useState<WorkoutStatus>('idle');
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [timer, setTimer] = useState(0);
    const [workoutProgress, setWorkoutProgress] = useState(0);
    const [performanceLogs, setPerformanceLogs] = useState<any[]>([]);
    const [startTime, setStartTime] = useState<Date | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/beep.mp3');
    }, []);

    const currentBlock: WorkoutBlock | null = useMemo(() => workout?.blocks[currentBlockIndex] || null, [workout, currentBlockIndex]);
    const currentSet: Set | null = useMemo(() => {
        if (currentBlock?.type === 'exercise') {
            return (currentBlock as ExerciseBlock).sets[currentSetIndex] || null;
        }
        return null;
    }, [currentBlock, currentSetIndex]);

    const advanceToNextBlock = useCallback(() => {
        if (!workout) return;
        const nextBlockIndex = currentBlockIndex + 1;

        if (nextBlockIndex >= workout.blocks.length) {
            setStatus('finished');
        } else {
            setCurrentBlockIndex(nextBlockIndex);
            setCurrentSetIndex(0);
            const nextBlock = workout.blocks[nextBlockIndex];
            if(nextBlock.type === 'rest') {
                setStatus('resting');
                setTimer(nextBlock.duration);
            } else {
                 startNextSet(nextBlockIndex, 0);
            }
        }
    }, [currentBlockIndex, workout]);


    const startNextSet = useCallback((blockIndex: number, setIndex: number) => {
        if (!workout) return;
        const block = workout.blocks[blockIndex];
        if (block?.type === 'exercise') {
            const exerciseBlock = block as ExerciseBlock;
            const nextSet = exerciseBlock.sets[setIndex];
            if (nextSet) {
                if (nextSet.metric === 'time') {
                    setTimer(parseInt(nextSet.value || '0', 10));
                    setStatus('exercising');
                } else {
                    setStatus('rep_based_pause');
                }
            }
        }
    }, [workout]);

    const completeSet = useCallback((log?: { reps: number, weight: number }) => {
        if (status !== 'rep_based_pause' && status !== 'exercising') return;

        if (log && currentBlock?.type === 'exercise') {
            const newLog = { blockId: currentBlock.id, setIndex: currentSetIndex, ...log };
            setPerformanceLogs(prev => [...prev, newLog]);
        }

        const isLastSet = currentBlock?.type === 'exercise' && currentSetIndex >= (currentBlock as ExerciseBlock).sets.length - 1;
        const restDuration = parseInt((currentBlock as ExerciseBlock)?.restBetweenSets || '0', 10);
        
        if (isLastSet) {
            advanceToNextBlock();
        } else {
            const nextSetIndex = currentSetIndex + 1;
            setCurrentSetIndex(nextSetIndex);
            if (restDuration > 0) {
                setStatus('resting');
                setTimer(restDuration);
            } else {
                startNextSet(currentBlockIndex, nextSetIndex);
            }
        }
    }, [status, currentBlock, currentSetIndex, advanceToNextBlock, startNextSet, currentBlockIndex]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((status === 'exercising' || status === 'resting') && timer > 0) {
            interval = setInterval(() => setTimer(prev => prev - 1), 1000);
        } else if (timer <= 0) {
            if (status === 'exercising') {
                completeSet();
            } else if (status === 'resting') {
                const nextSetIndex = currentSetIndex + 1;
                 if (currentBlock?.type === 'exercise' && nextSetIndex < currentBlock.sets.length) {
                    setCurrentSetIndex(nextSetIndex);
                    startNextSet(currentBlockIndex, nextSetIndex);
                } else {
                    advanceToNextBlock();
                }
            }
        }
        return () => clearInterval(interval);
    }, [status, timer, completeSet, currentBlock, currentSetIndex, startNextSet, currentBlockIndex, advanceToNextBlock]);


    useEffect(() => {
        if (status === 'finished' && workout && userId && startTime) {
            const finalLog: PerformanceLog = {
                userId,
                workoutId: workout.id,
                programId: programId || null,
                completedAt: new Date(),
                duration: Math.round((new Date().getTime() - startTime.getTime()) / 1000),
                performance: performanceLogs,
            };
            logWorkoutPerformanceAction(finalLog);
        }
    }, [status, workout, userId, programId, performanceLogs, startTime]);

    const startWorkout = useCallback(() => {
        if (!workout || workout.blocks.length === 0) return;
        setCurrentBlockIndex(0);
        setCurrentSetIndex(0);
        setPerformanceLogs([]);
        setStartTime(new Date());
        const firstBlock = workout.blocks[0];
        if(firstBlock.type === 'rest') {
            setStatus('resting');
            setTimer(firstBlock.duration);
        } else {
            startNextSet(0, 0);
        }
    }, [workout, startNextSet]);

    const pauseWorkout = () => {
        if (status === 'exercising' || status === 'resting' || status === 'rep_based_pause') {
            setStatus('paused');
        }
    };

    const resumeWorkout = () => {
        if (status !== 'paused') return;
        const block = currentBlock;
        if (!block) return;

        if (block.type === 'rest') {
            setStatus('resting');
        } else if (block.type === 'exercise') {
            const set = block.sets[currentSetIndex];
            setStatus(set.metric === 'time' ? 'exercising' : 'rep_based_pause');
        } 
    };

    const endWorkout = () => {
        setStatus('finished');
    };

    const skipRest = () => {
        if (status === 'resting') {
            setTimer(0);
        }
    };

    useEffect(() => {
        if (!workout) {
            setWorkoutProgress(0);
            return;
        }
        const totalSets = workout.blocks.reduce((acc, block) => {
            if (block.type === 'exercise') return acc + block.sets.length;
            return acc;
        }, 0);

        const completedSets = performanceLogs.length;

        const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
        setWorkoutProgress(progress > 100 ? 100 : progress);

    }, [performanceLogs, workout]);

    return {
        status,
        currentBlock,
        currentSet,
        timer,
        workoutProgress,
        startWorkout,
        pauseWorkout,
        resumeWorkout,
        completeSet,
        endWorkout,
        skipRest,
    };
}
