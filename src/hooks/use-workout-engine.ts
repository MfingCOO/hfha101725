'use client';

import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { Workout, WorkoutBlock, ExerciseBlock, Set } from '@/types/workout-program';

// --- STATE, ACTIONS, and REDUCER ---

type WorkoutStatus = 'idle' | 'exercising' | 'resting' | 'paused' | 'rep_based_pause' | 'finished';

interface WorkoutEngineState {
  status: WorkoutStatus;
  workout: Workout | null;
  currentBlockIndex: number;
  currentSetIndex: number;
  timer: number;
  startTime: number | null;
  elapsedTime: number;
  performanceData: any[];
}

type Action = 
  | { type: 'START_WORKOUT'; workout: Workout } 
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END_WORKOUT' }
  | { type: 'SKIP_REST' }
  | { type: 'TICK' }
  | { type: 'COMPLETE_SET'; log?: { reps: number; weight: number } };

const initialState: WorkoutEngineState = {
  status: 'idle',
  workout: null,
  currentBlockIndex: 0,
  currentSetIndex: 0,
  timer: 0,
  startTime: null,
  elapsedTime: 0,
  performanceData: [],
};

function workoutEngineReducer(state: WorkoutEngineState, action: Action): WorkoutEngineState {
  const getCurrentBlock = () => state.workout?.blocks[state.currentBlockIndex] || null;

  switch (action.type) {
    case 'START_WORKOUT': {
      const firstBlock = action.workout.blocks[0];
      if (!firstBlock) return { ...initialState, workout: action.workout, status: 'finished' };

      let status: WorkoutStatus = 'rep_based_pause';
      let timer = 0;

      if (firstBlock.type === 'rest') {
        status = 'resting';
        timer = firstBlock.duration;
      } else if (firstBlock.type === 'exercise') {
        const firstSet = firstBlock.sets[0];
        if (firstSet?.metric === 'time') {
          status = 'exercising';
          timer = parseInt(String(firstSet.value) || '0', 10);
        }
      }
      return { ...initialState, workout: action.workout, status, timer, startTime: Date.now() };
    }

    case 'PAUSE':
      if (['exercising', 'resting', 'rep_based_pause'].includes(state.status)) {
        return { ...state, status: 'paused' };
      }
      return state;

    case 'RESUME': {
        if (state.status !== 'paused') return state;
        const block = getCurrentBlock();
        if(!block) return state;

        if (block.type === 'rest') return { ...state, status: 'resting' };
        if (block.type === 'exercise') {
            const set = (block as ExerciseBlock).sets[state.currentSetIndex];
            return { ...state, status: set?.metric === 'time' ? 'exercising' : 'rep_based_pause' };
        }
        return state;
    }

    case 'TICK': {
        if (!['exercising', 'resting'].includes(state.status) || state.timer <= 0) {
            return state;
        }
        
        const newElapsedTime = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : state.elapsedTime;
        const newTimer = state.timer - 1;

        if (newTimer > 0) {
            return { ...state, timer: newTimer, elapsedTime: newElapsedTime };
        }

        // Timer finished. Create a temporary state and then call the reducer again with the appropriate action
        // to reuse the advancement logic without duplicating it here.
        const tempState = { ...state, timer: 0, elapsedTime: newElapsedTime };

        if (state.status === 'resting') {
            const currentBlock = getCurrentBlock();
            // If we were resting before a set in an exercise block
            if (currentBlock?.type === 'exercise') {
                const nextSet = (currentBlock as ExerciseBlock).sets[state.currentSetIndex];
                if (nextSet) {
                    return {
                        ...tempState,
                        status: nextSet.metric === 'time' ? 'exercising' : 'rep_based_pause',
                        timer: nextSet.metric === 'time' ? parseInt(String(nextSet.value) || '0', 10) : 0,
                    };
                } 
            }
            // If it was a standalone rest block, advance by treating it as a completed set of a block.
            return workoutEngineReducer(tempState, { type: 'COMPLETE_SET' });
        } else { // Timed exercise finished
            return workoutEngineReducer(tempState, { type: 'COMPLETE_SET' });
        }
    }

    case 'COMPLETE_SET': {
        let newState = { ...state };
        if (action.log) {
            const block = getCurrentBlock();
            if (block) {
                const newLog = { blockId: block.id, setIndex: state.currentSetIndex, ...action.log };
                newState.performanceData = [...state.performanceData, newLog];
            }
        }

        const currentBlock = getCurrentBlock();
        
        // This condition handles advancing to the next block. It triggers if:
        // 1. The current block is a standalone rest block.
        // 2. We just finished the last set of an exercise block.
        if (!currentBlock || currentBlock.type === 'rest' || newState.currentSetIndex >= (currentBlock as ExerciseBlock).sets.length - 1) {
            const nextBlockIndex = newState.currentBlockIndex + 1;
            const nextBlock = newState.workout?.blocks[nextBlockIndex];

            // No next block? Workout is finished.
            if (!nextBlock) return { ...newState, status: 'finished' };

            let nextStatus: WorkoutStatus = 'rep_based_pause';
            let nextTimer = 0;
            if (nextBlock.type === 'rest') {
                nextStatus = 'resting';
                nextTimer = nextBlock.duration;
            } else if (nextBlock.type === 'exercise') {
                const nextSet = nextBlock.sets[0];
                if (nextSet?.metric === 'time') {
                    nextStatus = 'exercising';
                    nextTimer = parseInt(String(nextSet.value) || '0', 10);
                }
            }
            return { ...newState, currentBlockIndex: nextBlockIndex, currentSetIndex: 0, status: nextStatus, timer: nextTimer };
        }
        
        // Not the last set, so move to rest period before the next set.
        const restBetweenSets = parseInt(String((currentBlock as ExerciseBlock).restBetweenSets) || '0', 10);
        const nextSetIndex = newState.currentSetIndex + 1;

        if (restBetweenSets > 0) {
            return { ...newState, status: 'resting', timer: restBetweenSets, currentSetIndex: nextSetIndex };
        } else {
             // No rest, go straight to the next set.
            const nextSet = (currentBlock as ExerciseBlock).sets[nextSetIndex];
            return {
                ...newState,
                currentSetIndex: nextSetIndex,
                status: nextSet.metric === 'time' ? 'exercising' : 'rep_based_pause',
                timer: nextSet.metric === 'time' ? parseInt(String(nextSet.value) || '0', 10) : 0,
            };
        }
    }

    case 'SKIP_REST':
        if (state.status === 'resting') {
            // Set timer to 1 and let the TICK logic handle the advancement. This is safer
            // than calling the reducer directly and prevents race conditions or loops.
            return { ...state, timer: 1 };
        }
        return state;

    case 'END_WORKOUT':
      return { ...state, status: 'finished' };

    default:
      return state;
  }
}

// --- HOOK ---

export function useWorkoutEngine(workout: Workout | null) {
  const [state, dispatch] = useReducer(workoutEngineReducer, initialState);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (state.timer > 0 && (state.status === 'exercising' || state.status === 'resting')) {
        interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    }
    return () => clearInterval(interval);
  }, [state.timer, state.status]);

  const startWorkout = useCallback(() => {
      if(workout) dispatch({ type: 'START_WORKOUT', workout });
  }, [workout]);

  const pauseWorkout = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const resumeWorkout = useCallback(() => dispatch({ type: 'RESUME' }), []);
  const endWorkout = useCallback(() => dispatch({ type: 'END_WORKOUT' }), []);
  const skipRest = useCallback(() => dispatch({ type: 'SKIP_REST' }), []);
  const completeSet = useCallback((log?: { reps: number; weight: number }) => {
      dispatch({ type: 'COMPLETE_SET', log });
  }, []);

  const currentBlock = useMemo(() => state.workout?.blocks[state.currentBlockIndex] || null, [state.workout, state.currentBlockIndex]);
  const currentSet = useMemo(() => {
    if (currentBlock?.type === 'exercise') {
        return (currentBlock as ExerciseBlock).sets[state.currentSetIndex] || null;
    }
    return null;
  }, [currentBlock, state.currentSetIndex]);

  const workoutProgress = useMemo(() => {
    if (!state.workout) return 0;
    const totalSets = state.workout.blocks.reduce((acc, block) => {
        if (block.type === 'exercise') return acc + block.sets.length;
        return acc;
    }, 0);
    if (totalSets === 0) return 100;
    const completedSets = state.performanceData.length;
    return Math.min(100, (completedSets / totalSets) * 100);
  }, [state.workout, state.performanceData]);

  return {
    status: state.status,
    timer: state.timer,
    workoutProgress,
    currentBlock,
    currentSet,
    startTime: state.startTime,
    elapsedTime: state.elapsedTime,
    performanceData: state.performanceData,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    completeSet,
    endWorkout,
    skipRest,
  };
}
