'use client';
import { useReducer, useEffect, useCallback, useMemo } from 'react';
import { Workout, ExerciseBlock, WorkoutBlock, GroupBlock, RestBlock } from '@/types/workout-program';

// --- STATE, ACTIONS, and REDUCER ---
type WorkoutStatus = 'idle' | 'exercising' | 'resting' | 'paused' | 'rep_based_pause' | 'finished';

interface WorkoutEngineState {
  status: WorkoutStatus;
  workout: Workout | null;
  executionFlow: Array<ExerciseBlock | RestBlock>;
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
  | { type: 'ADVANCE' }
  | { type: 'COMPLETE_SET'; log?: { reps: number; weight: number } };

const initialState: WorkoutEngineState = {
  status: 'idle',
  workout: null,
  executionFlow: [],
  currentBlockIndex: 0,
  currentSetIndex: 0,
  timer: 0,
  startTime: null,
  elapsedTime: 0,
  performanceData: [],
};

const createExecutionFlow = (blocks: WorkoutBlock[]): Array<ExerciseBlock | RestBlock> => {
    const flow: Array<ExerciseBlock | RestBlock> = [];

    for (const block of blocks) {
        if (block.type === 'group') {
            const groupBlock = block as GroupBlock;
            const rounds = Number(groupBlock.rounds) || 1;
            const restBetweenRounds = Number(groupBlock.restBetweenRounds) || 0;
            const exercisesInGroup = groupBlock.blocks;

            for (let i = 0; i < rounds; i++) {
                exercisesInGroup.forEach((exercise, j) => {
                    const setToUse = exercise.sets[i] || exercise.sets[0];
                    if (setToUse) {
                        const singleSetExerciseBlock: ExerciseBlock = {
                            ...exercise,
                            id: `${exercise.id}-round-${i}`,
                            sets: [setToUse],
                            restBetweenSets: '0',
                            groupInfo: {
                                name: groupBlock.name,
                                currentRound: i + 1,
                                totalRounds: rounds,
                                exerciseIndex: j + 1,
                                totalExercises: exercisesInGroup.length,
                            },
                        };
                        flow.push(singleSetExerciseBlock);
                    }
                });

                if (restBetweenRounds > 0 && i < rounds - 1) {
                    const restBlock: RestBlock = {
                        id: `${groupBlock.id}-round-rest-${i}`,
                        type: 'rest',
                        duration: restBetweenRounds,
                    };
                    flow.push(restBlock);
                }
            }
        } else {
            flow.push(block as ExerciseBlock | RestBlock);
        }
    }
    return flow;
};

function workoutEngineReducer(state: WorkoutEngineState, action: Action): WorkoutEngineState {
  const { status, executionFlow, currentBlockIndex, currentSetIndex } = state;

  switch (action.type) {
    case 'START_WORKOUT': {
      const newExecutionFlow = createExecutionFlow(action.workout.blocks);
      if (newExecutionFlow.length === 0) return { ...initialState, workout: action.workout, status: 'finished' };

      const firstBlock = newExecutionFlow[0];
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
      return { ...initialState, workout: action.workout, executionFlow: newExecutionFlow, status: nextStatus, timer: nextTimer, startTime: Date.now() };
    }

    case 'PAUSE':
      if (['exercising', 'resting', 'rep_based_pause'].includes(status)) {
        return { ...state, status: 'paused' };
      }
      return state;

    case 'RESUME': {
        if (state.status !== 'paused') return state;
        const block = executionFlow[currentBlockIndex];
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
        
        return workoutEngineReducer({ ...state, timer: 0, elapsedTime: newElapsedTime }, { type: 'ADVANCE' });
    }
    
    case 'COMPLETE_SET': {
        let newState = { ...state };
        if (action.log) {
            const block = executionFlow[currentBlockIndex];
            if (block) {
                newState.performanceData = [...state.performanceData, { blockId: block.id, setIndex: currentSetIndex, ...action.log }];
            }
        }
        return workoutEngineReducer(newState, { type: 'ADVANCE' });
    }
    
    case 'ADVANCE': {
        const currentBlock = executionFlow[currentBlockIndex];
        if (!currentBlock) return { ...state, status: 'finished' };

        if (currentBlock.type === 'exercise' && currentSetIndex < currentBlock.sets.length - 1) {
            const restTime = parseInt(String(currentBlock.restBetweenSets) || '0', 10);
            const nextSetIndex = currentSetIndex + 1;

            if (restTime > 0 && status !== 'resting') {
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

        const nextBlockIndex = currentBlockIndex + 1;
        const nextBlock = executionFlow[nextBlockIndex];

        if (!nextBlock) {
            const finalElapsedTime = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : state.elapsedTime;
            return { ...state, status: 'finished', elapsedTime: finalElapsedTime };
        }

        let nextStatus: WorkoutStatus = 'rep_based_pause';
        let nextTimer = 0;

        if (nextBlock.type === 'rest') {
            nextStatus = 'resting';
            nextTimer = nextBlock.duration;
        } else if (nextBlock.type === 'exercise') {
            const firstSet = nextBlock.sets[0];
            if (firstSet?.metric === 'time') {
                nextStatus = 'exercising';
                nextTimer = parseInt(String(firstSet.value) || '0', 10);
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
        dispatch({ type: 'ADVANCE' });
    }
  }, [state.status]);

  const skipExercise = useCallback(() => {
      if (state.status === 'exercising') {
          dispatch({ type: 'ADVANCE' });
      }
  }, [state.status]);

  const completeSet = useCallback((log?: { reps: number; weight: number }) => {
      dispatch({ type: 'COMPLETE_SET', log });
  }, []);

  const currentBlock = useMemo(() => state.executionFlow[state.currentBlockIndex] || null, [state.executionFlow, state.currentBlockIndex]);
  const currentSet = useMemo(() => {
    if (currentBlock?.type === 'exercise') {
        return (currentBlock as ExerciseBlock).sets[state.currentSetIndex] || null;
    }
    return null;
  }, [currentBlock, state.currentSetIndex]);

  const totalSetsInFlow = useMemo(() => {
    return state.executionFlow.reduce((acc, block) => {
        if (block.type === 'exercise') return acc + block.sets.length;
        return acc;
    }, 0);
  }, [state.executionFlow]);

  const workoutProgress = useMemo(() => {
    if (totalSetsInFlow === 0) return 100;
    const completedSets = state.performanceData.length;
    return Math.min(100, (completedSets / totalSetsInFlow) * 100);
  }, [state.performanceData.length, totalSetsInFlow]);

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
    skipExercise,
  };
}
