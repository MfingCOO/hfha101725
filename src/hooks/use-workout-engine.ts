'use client';
import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { Workout, ExerciseBlock } from '@/types/workout-program';

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
  | { type: 'TICK' }
  | { type: 'ADVANCE' } // Unified action to advance the workout state
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
  const { status, workout, currentBlockIndex, currentSetIndex } = state;

  switch (action.type) {
    case 'START_WORKOUT': {
      const firstBlock = action.workout.blocks[0];
      if (!firstBlock) return { ...initialState, workout: action.workout, status: 'finished' };

      let nextStatus: WorkoutStatus = 'rep_based_pause';
      let nextTimer = 0;

      if (firstBlock.type === 'rest') {
        nextStatus = 'resting';
        nextTimer = firstBlock.duration;
      } else if (firstBlock.type === 'exercise') {
        const firstSet = firstBlock.sets[0];
        if (firstSet?.metric === 'time') {
          nextStatus = 'exercising';
          nextTimer = parseInt(String(firstSet.value) || '0', 10);
        }
      }
      return { ...initialState, workout: action.workout, status: nextStatus, timer: nextTimer, startTime: Date.now() };
    }

    case 'PAUSE':
      if (['exercising', 'resting', 'rep_based_pause'].includes(status)) {
        return { ...state, status: 'paused' };
      }
      return state;

    case 'RESUME': {
        if (state.status !== 'paused') return state;
        const block = workout?.blocks[currentBlockIndex];
        if(!block) return state;

        if (block.type === 'rest') return { ...state, status: 'resting' };
        if (block.type === 'exercise') {
            const set = (block as ExerciseBlock).sets[currentSetIndex];
            return { ...state, status: set?.metric === 'time' ? 'exercising' : 'rep_based_pause' };
        }
        return state;
    }

    case 'TICK': {
        if (!['exercising', 'resting'].includes(status) || state.timer <= 0) {
            return state;
        }
        const newTimer = state.timer - 1;
        const newElapsedTime = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : state.elapsedTime;

        if (newTimer > 0) {
            return { ...state, timer: newTimer, elapsedTime: newElapsedTime };
        }
        
        // Timer hit 0, advance the workout.
        return workoutEngineReducer({ ...state, timer: 0, elapsedTime: newElapsedTime }, { type: 'ADVANCE' });
    }
    
    case 'COMPLETE_SET': {
        let newState = { ...state };
        if (action.log) {
            const block = workout?.blocks[currentBlockIndex];
            if (block) {
                newState.performanceData = [...state.performanceData, { blockId: block.id, setIndex: currentSetIndex, ...action.log }];
            }
        }
        return workoutEngineReducer(newState, { type: 'ADVANCE' });
    }
    
    case 'ADVANCE': {
        const currentBlock = workout?.blocks[currentBlockIndex];
        if (!currentBlock) return { ...state, status: 'finished' };

        // CASE 1: Finished a REST period.
        if (status === 'resting') {
            const nextSet = (currentBlock as ExerciseBlock)?.sets[currentSetIndex];
            if (!nextSet) return workoutEngineReducer(state, { type: 'END_WORKOUT' }); // Failsafe

            return {
                ...state,
                status: nextSet.metric === 'time' ? 'exercising' : 'rep_based_pause',
                timer: nextSet.metric === 'time' ? parseInt(String(nextSet.value) || '0', 10) : 0,
            };
        }
        
        // CASE 2: Finished an EXERCISE set.
        if (currentBlock.type === 'exercise') {
            const isLastSet = currentSetIndex >= currentBlock.sets.length - 1;
            if (!isLastSet) {
                const restTime = parseInt(String(currentBlock.restBetweenSets) || '0', 10);
                const nextSetIndex = currentSetIndex + 1;

                if (restTime > 0) {
                    return { ...state, status: 'resting', timer: restTime, currentSetIndex: nextSetIndex };
                }

                const nextSet = currentBlock.sets[nextSetIndex];
                return {
                    ...state,
                    currentSetIndex: nextSetIndex,
                    status: nextSet.metric === 'time' ? 'exercising' : 'rep_based_pause',
                    timer: nextSet.metric === 'time' ? parseInt(String(nextSet.value) || '0', 10) : 0,
                };
            }
        }

        // CASE 3: Finished a BLOCK (last set of an exercise, or a standalone rest block).
        const nextBlockIndex = currentBlockIndex + 1;
        const nextBlock = workout?.blocks[nextBlockIndex];

        if (!nextBlock) {
            // THIS IS THE FIX: Calculate final time at the exact moment of completion.
            const finalElapsedTime = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : state.elapsedTime;
            return { ...state, status: 'finished', elapsedTime: finalElapsedTime };
        }

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
        return { ...state, currentBlockIndex: nextBlockIndex, currentSetIndex: 0, status: nextStatus, timer: nextTimer };
    }

    case 'END_WORKOUT':
      return { ...state, status: 'finished', elapsedTime: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : state.elapsedTime };

    default:
      return state;
  }
}

// --- HOOK ---

export function useWorkoutEngine(workout: Workout | null) {
  const [state, dispatch] = useReducer(workoutEngineReducer, initialState);

  useEffect(() => {
    if (!['exercising', 'resting'].includes(state.status) || state.timer <= 0) {
        return;
    }
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.status, state.timer]);

  const startWorkout = useCallback(() => {
      if(workout) dispatch({ type: 'START_WORKOUT', workout });
  }, [workout]);

  const pauseWorkout = useCallback(() => dispatch({ type: 'PAUSE' }), []);
  const resumeWorkout = useCallback(() => dispatch({ type: 'RESUME' }), []);
  const endWorkout = useCallback(() => dispatch({ type: 'END_WORKOUT' }), []);
  const skipRest = useCallback(() => {
    if (state.status === 'resting') {
        // Directly advance the state, bypassing timers.
        dispatch({ type: 'ADVANCE' });
    }
  }, [state.status]);

  const completeSet = useCallback((log?: { reps: number; weight: number }) => {
      dispatch({ type: 'COMPLETE_SET', log });
  }, []);

  // --- Memoized Selectors for the UI ---
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