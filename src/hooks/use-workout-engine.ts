'use client';

import { useState, useEffect, useCallback } from 'react';
import { Workout, WorkoutBlock, ExerciseBlock, RestBlock } from '@/types/workout-program';

// Defines the possible states of the workout player
type WorkoutStatus = 'idle' | 'exercising' | 'resting' | 'finished';

export function useWorkoutEngine(workout: Workout | null) {
    const [status, setStatus] = useState<WorkoutStatus>('idle');
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [timer, setTimer] = useState(0);
    const [workoutProgress, setWorkoutProgress] = useState(0);

    const currentBlock: WorkoutBlock | null = workout?.blocks[currentBlockIndex] || null;

    // Timer Countdown Effect
    useEffect(() => {
        if (status !== 'resting' || timer <= 0) {
            return;
        }

        const interval = setInterval(() => {
            setTimer(prev => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [status, timer]);

    // Function to start the workout
    const startWorkout = useCallback(() => {
        if (!workout || workout.blocks.length === 0) return;
        setCurrentBlockIndex(0);
        setCurrentSetIndex(0);
        setTimer(0);
        setStatus('exercising');
        console.log("Workout started!");
    }, [workout]);

    // Function to advance to the next block or finish
    const advanceToNextBlock = useCallback(() => {
        if (!workout) return;

        const nextBlockIndex = currentBlockIndex + 1;
        if (nextBlockIndex >= workout.blocks.length) {
            setStatus('finished');
            console.log("Workout finished!");
        } else {
            setCurrentBlockIndex(nextBlockIndex);
            setCurrentSetIndex(0);
            const nextBlock = workout.blocks[nextBlockIndex];
            
            if (nextBlock.type === 'rest') {
                setStatus('resting');
                setTimer((nextBlock as RestBlock).duration);
            } else {
                setStatus('exercising');
            }
        }
    }, [currentBlockIndex, workout]);
    
    // Effect to handle timer completion
    useEffect(() => {
        if (status === 'resting' && timer <= 0) {
            advanceToNextBlock();
        }
    }, [status, timer, advanceToNextBlock]);

    // Function to handle completing a set
    const completeSet = useCallback(() => {
        if (!currentBlock || currentBlock.type !== 'exercise') return;

        const exercise = currentBlock as ExerciseBlock;
        const nextSetIndex = currentSetIndex + 1;

        if (nextSetIndex >= exercise.sets.length) {
            // Last set completed, check for rest and move to next block
            const restDuration = 60; // TODO: Get from workout data, e.g., exercise.restBetweenSets
            setStatus('resting');
            setTimer(restDuration);
            // In this simplified model, we'll advance after the rest.
            // A more robust model might wait for a "skip rest" or for the timer to end.
        } else {
            // More sets to go, start rest timer for next set
            setCurrentSetIndex(nextSetIndex);
            const restDuration = 60; // TODO: Get from workout data
            setStatus('resting');
            setTimer(restDuration);
        }
    }, [currentBlock, currentSetIndex, advanceToNextBlock]);

    // Function to skip the current rest period
    const skipRest = () => {
        if (status !== 'resting') return;
        setTimer(0);
        // The timer completion effect will handle advancing to the next block
    };

    // Function to end the workout prematurely
    const endWorkout = () => {
        setStatus('finished');
        console.log("Workout ended by user.");
    };

    // Calculate overall progress
    useEffect(() => {
        if (!workout) {
            setWorkoutProgress(0);
            return;
        }
        const totalBlocks = workout.blocks.length;
        const progress = totalBlocks > 0 ? ((currentBlockIndex + 1) / totalBlocks) * 100 : 0;
        setWorkoutProgress(progress);
    }, [currentBlockIndex, workout]);

    return {
        status,
        currentBlock,
        currentSetIndex,
        timer,
        workoutProgress,
        startWorkout,
        completeSet,
        skipRest,
        endWorkout,
    };
}
