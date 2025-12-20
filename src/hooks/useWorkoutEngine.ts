import { useState, useEffect, useCallback, useMemo } from 'react';
import { Workout, WorkoutBlock, ExerciseBlock, RestBlock, Set } from '@/types/workout-program';

export type WorkoutStatus = 'idle' | 'exercising' | 'resting' | 'finished';

export type PerformanceData = {
    [key: string]: { reps: (number | null)[], weight: (number | null)[] };
};

export const useWorkoutEngine = (workout: Workout | null) => {
    const [status, setStatus] = useState<WorkoutStatus>('idle');
    const [allBlocks, setAllBlocks] = useState<WorkoutBlock[]>([]);
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [performanceData, setPerformanceData] = useState<PerformanceData>({});
    const [timer, setTimer] = useState(0);
    const [isTimerActive, setIsTimerActive] = useState(false);

    useEffect(() => {
        if (!workout) {
            setStatus('idle');
            return;
        }

        const flattenedBlocks = workout.blocks.flatMap(block => 
            block.type === 'group' ? block.blocks : [block]
        );
        setAllBlocks(flattenedBlocks);

        const initialPerformanceData: PerformanceData = {};
        flattenedBlocks.forEach(block => {
            if (block.type === 'exercise') {
                initialPerformanceData[block.id] = {
                    reps: Array(block.sets.length).fill(null),
                    weight: Array(block.sets.length).fill(null),
                };
            }
        });
        setPerformanceData(initialPerformanceData);
        setStatus('idle');

    }, [workout]);

    const currentBlock = useMemo(() => allBlocks[currentBlockIndex], [allBlocks, currentBlockIndex]);
    const nextBlock = useMemo(() => allBlocks[currentBlockIndex + 1], [allBlocks, currentBlockIndex]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerActive && timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (isTimerActive && timer === 0) {
            setIsTimerActive(false);
            advanceToNext(); 
        }
        return () => clearInterval(interval);
    }, [timer, isTimerActive]);

    const advanceToNext = useCallback(() => {
        setIsTimerActive(false);

        if (!currentBlock) {
            setStatus('finished');
            return;
        }

        if (currentBlock.type === 'exercise' && currentSetIndex < currentBlock.sets.length - 1) {
            setCurrentSetIndex(prev => prev + 1);
            setStatus('exercising');
        } else {
            if (currentBlockIndex < allBlocks.length - 1) {
                const nextBlockIndex = currentBlockIndex + 1;
                setCurrentBlockIndex(nextBlockIndex);
                setCurrentSetIndex(0);
                const nextBlock = allBlocks[nextBlockIndex];

                if (nextBlock.type === 'rest') {
                    setStatus('resting');
                    setTimer(nextBlock.duration);
                    setIsTimerActive(true);
                } else {
                    setStatus('exercising');
                }
            } else {
                setStatus('finished');
            }
        }
    }, [currentBlock, currentSetIndex, currentBlockIndex, allBlocks]);

    const startWorkout = useCallback(() => {
        if (allBlocks.length > 0) {
            const firstBlock = allBlocks[0];
            if (firstBlock.type === 'rest') {
                setStatus('resting');
                setTimer(firstBlock.duration);
                setIsTimerActive(true);
            } else {
                setStatus('exercising');
            }
        }
    }, [allBlocks]);
    
    const completeSet = useCallback((reps: number, weight: number) => {
        if (currentBlock?.type !== 'exercise') return;

        setPerformanceData(prev => {
            const newReps = [...prev[currentBlock.id].reps];
            const newWeights = [...prev[currentBlock.id].weight];
            newReps[currentSetIndex] = reps;
            newWeights[currentSetIndex] = weight;
            return { ...prev, [currentBlock.id]: { reps: newReps, weight: newWeights } };
        });

        const restDurationString = (currentBlock as ExerciseBlock).restBetweenSets;
        if (restDurationString) {
            const restDuration = parseInt(restDurationString, 10);
            if (restDuration > 0) {
                setStatus('resting');
                setTimer(restDuration);
                setIsTimerActive(true);
                return; 
            }
        }
        
        advanceToNext();

    }, [currentBlock, currentSetIndex, advanceToNext]);
    
    const skipRest = () => {
        if (status === 'resting') {
            setTimer(0);
            setIsTimerActive(false);
            advanceToNext();
        }
    };

    const endWorkout = useCallback(() => {
        setStatus('finished');
        setIsTimerActive(false);
    }, []);

    const workoutProgress = useMemo(() => {
        if (!workout || allBlocks.length === 0) return 0;
        const totalBlocks = allBlocks.length;
        if (status === 'finished') return 100;
        return (currentBlockIndex / totalBlocks) * 100;
    }, [currentBlockIndex, allBlocks, status, workout]);

    return {
        status,
        currentBlock,
        nextBlock,
        currentSetIndex,
        performanceData,
        timer,
        isTimerActive,
        workoutProgress,
        startWorkout,
        completeSet,
        skipRest,
        endWorkout,
    };
};