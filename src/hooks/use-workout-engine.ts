'use client';
import { useEffect, useMemo, useCallback } from 'react';
import { useWorkoutEngineStore } from '@/store/workout-engine-store';
import { Workout, ExerciseBlock } from '@/types/workout-program';

/**
 * A hook that provides a clean, component-friendly interface to the workout engine.
 * It abstracts away the global state management and provides the necessary data and actions
 * for the UI to display and control the workout.
 */
export function useWorkoutEngine(workout: Workout | null) {
  // --- STATE SELECTION from the global store ---
  const {
    status,
    timer,
    startTime,
    elapsedTime,
    performanceData,
    executionFlow,
    currentBlockIndex,
    tick,
    startWorkout: startWorkoutAction,
    pause,
    resume,
    completeSet,
    endWorkout,
    skipRest,
    skipExercise,
    reset,
  } = useWorkoutEngineStore();

  // --- TIMER EFFECT ---
  useEffect(() => {
    // If the timer is active in the global store, set up an interval.
    if (['exercising', 'resting'].includes(status)) {
      const interval = setInterval(() => {
        tick(); // Call the tick action on the global store.
      }, 1000);

      // Clean up the interval when the component unmounts or the status changes.
      return () => clearInterval(interval);
    }
  }, [status, tick]);

  // --- START WORKOUT ACTION ---
  // This function is exposed to the UI and will trigger the workout to start in the store.
  const startWorkout = useCallback(() => {
    if (workout) {
      startWorkoutAction(workout);
    }
  }, [workout, startWorkoutAction]);

  // --- DERIVED MEMOIZED VALUES ---
  const currentBlock = useMemo(() =>
    executionFlow[currentBlockIndex] || null,
    [executionFlow, currentBlockIndex]
  );

  const currentSet = useMemo(() => {
    if (currentBlock?.type === 'exercise') {
      return (currentBlock as ExerciseBlock).sets[0] || null;
    }
    return null;
  }, [currentBlock]);

  const totalSetsInFlow = useMemo(() =>
    executionFlow.filter(b => b.type === 'exercise').length,
    [executionFlow]
  );

  const workoutProgress = useMemo(() => {
    if (!workout || status === 'idle') return 0;
    if (status === 'finished') return 100;
    if (totalSetsInFlow === 0) return 100;

    const completedSets = performanceData.length;
    return Math.min(100, (completedSets / totalSetsInFlow) * 100);
  }, [performanceData.length, totalSetsInFlow, status, workout]);


  // --- PUBLIC API of the hook ---
  return {
    status,
    timer,
    workoutProgress,
    currentBlock,
    currentSet,
    startTime,
    elapsedTime,
    performanceData,
    startWorkout,
    pauseWorkout: pause,
    resumeWorkout: resume,
    completeSet,
    endWorkout,
    skipRest,
    skipExercise,
    resetWorkout: reset,
  };
}
