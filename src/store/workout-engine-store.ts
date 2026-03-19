'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Workout, ExerciseBlock, WorkoutBlock, GroupBlock, RestBlock } from '@/types/workout-program';
import { playBeep, playLongBeep, initAudio } from '@/lib/audio';

export type WorkoutStatus = 'idle' | 'preparing' | 'exercising' | 'resting' | 'paused' | 'rep_based_pause' | 'finished' | 'empty';

export interface WorkoutEngineState {
  status: WorkoutStatus;
  workout: Workout | null;
  executionFlow: Array<ExerciseBlock | RestBlock>;
  currentBlockIndex: number;
  timer: number;
  startTime: number | null;
  elapsedTime: number;
  performanceData: Array<{ blockId: string; setIndex: number; reps: number; weight: number; }>;
}

export interface WorkoutEngineActions {
  startWorkout: (workout: Workout) => void;
  pause: () => void;
  resume: () => void;
  endWorkout: () => void;
  tick: () => void;
  completeSet: (log: { reps: number; weight: number }) => void;
  skipRest: () => void;
  skipExercise: () => void;
  reset: () => void;
  _advance: () => void;
}

const initialState: WorkoutEngineState = {
  status: 'idle',
  workout: null,
  executionFlow: [],
  currentBlockIndex: -1, 
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
                    const setIndex = exercise.sets[i] ? i : 0;
                    const setToUse = exercise.sets[setIndex];

                    if (setToUse) {
                        const singleSetExerciseBlock: ExerciseBlock = {
                            ...exercise,
                            id: `${exercise.id}-round-${i}-set-${j}`,
                            sets: [setToUse],
                            restBetweenSets: '0',
                            setIndex: setIndex, 
                            groupInfo: {
                                name: groupBlock.name,
                                currentRound: i + 1,
                                totalRounds: rounds,
                                exerciseIndex: j + 1,
                                totalExercises: exercisesInGroup.length,
                            },
                        };
                        flow.push(singleSetExerciseBlock);
                        if (exercise.restBetweenSets && Number(exercise.restBetweenSets) > 0 && j < exercisesInGroup.length - 1) {
                            flow.push({ id: `${groupBlock.id}-internal-rest-${i}-${j}`, type: 'rest', duration: Number(exercise.restBetweenSets) });
                        }
                    }
                });
                if (restBetweenRounds > 0 && i < rounds - 1) {
                    flow.push({ id: `${groupBlock.id}-round-rest-${i}`, type: 'rest', duration: restBetweenRounds });
                }
            }
        } else if (block.type === 'exercise') {
            const exerciseBlock = block as ExerciseBlock;
            exerciseBlock.sets.forEach((set, i) => {
                flow.push({ ...exerciseBlock, id: `${exerciseBlock.id}-set-${i}`, sets: [set], setIndex: i });
                if (i < exerciseBlock.sets.length - 1 && exerciseBlock.restBetweenSets && Number(exerciseBlock.restBetweenSets) > 0) {
                    flow.push({ id: `${exerciseBlock.id}-set-rest-${i}`, type: 'rest', duration: Number(exerciseBlock.restBetweenSets) });
                }
            });
        } else if (block.type === 'rest') {
            flow.push(block as RestBlock);
        }
    }
    return flow;
};

export const useWorkoutEngineStore = create<WorkoutEngineState & WorkoutEngineActions>()(
  persist(
    (set, get) => ({
      ...initialState,
      reset: () => set(initialState),
      startWorkout: (workout) => {
        initAudio(); // Call initAudio here
        const currentWorkoutId = get().workout?.id;
        if (currentWorkoutId !== workout.id) {
            get().reset();
        }

        const newExecutionFlow = createExecutionFlow(workout.blocks);
        if (newExecutionFlow.length === 0) {
          set({ workout, status: 'empty' });
          return;
        }

        const isResuming = get().workout?.id === workout.id && get().currentBlockIndex > -1;
        if (isResuming) {
            set({ status: 'paused' });
            return;
        }
        
        // --- FIX: Start with a "preparing" countdown ---
        set({
          ...initialState,
          workout,
          executionFlow: newExecutionFlow,
          status: 'preparing',
          timer: 4, // 3 beeps, 1 long beep
        });
      },
      pause: () => {
        const { status } = get();
        if (['preparing', 'exercising', 'resting', 'rep_based_pause'].includes(status)) {
          set({ status: 'paused' });
        }
      },
      resume: () => {
        const { status, executionFlow, currentBlockIndex, timer } = get();
        if (status !== 'paused') return;

        // If we were in the middle of the pre-workout countdown, just go back to it
        if (timer > 0 && currentBlockIndex === -1) {
            set({ status: 'preparing' });
            return;
        }

        const block = executionFlow[currentBlockIndex];
        if (!block) return;
        if (block.type === 'rest') set({ status: 'resting' });
        else if (block.type === 'exercise') {
          const setDef = block.sets[0];
          set({ status: setDef?.metric === 'time' ? 'exercising' : 'rep_based_pause' });
        }
      },
      endWorkout: () => {
        const { startTime, elapsedTime } = get();
        const finalElapsedTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : elapsedTime;
        set({ status: 'finished', elapsedTime: finalElapsedTime });
      },
      _advance: () => {
        const { executionFlow, currentBlockIndex } = get();
        const nextBlockIndex = currentBlockIndex + 1;
        const nextBlock = executionFlow[nextBlockIndex];
        if (!nextBlock) {
          get().endWorkout();
          return;
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
        set({ 
            currentBlockIndex: nextBlockIndex, 
            status: nextStatus, 
            timer: nextTimer, 
            startTime: get().startTime ?? Date.now() // Set start time on first advance
        });
      },
      tick: () => {
        const { status, timer, startTime } = get();
        if (!['preparing', 'exercising', 'resting'].includes(status) || timer <= 0) return;

        const newTimer = timer - 1;
        const newElapsedTime = startTime ? Math.floor((Date.now() - startTime) / 1000) : get().elapsedTime;

        // Standard countdown beeps
        if (newTimer === 10 || (newTimer <= 3 && newTimer >= 1)) {
            playBeep();
        }

        // Zero-second long beep
        if (newTimer === 0) {
            playLongBeep();
        }

        if (newTimer > 0) {
          set({ timer: newTimer, elapsedTime: newElapsedTime });
        } else {
          // Timer is finished, advance the workout state
          set({ timer: 0, elapsedTime: newElapsedTime });
          if (status === 'preparing') {
            get()._advance(); // First advance into the workout
          } else {
            get()._advance(); // Advance to the next block
          }
        }
      },
      completeSet: (log) => {
        const { performanceData, executionFlow, currentBlockIndex } = get();
        const block = executionFlow[currentBlockIndex] as ExerciseBlock | undefined;
        if (block && block.type === 'exercise' && log) {
          const newPerformanceEntry = {
            blockId: block.id,
            setIndex: block.setIndex ?? 0, 
            reps: log.reps,
            weight: log.weight,
          };
          set({ performanceData: [...performanceData, newPerformanceEntry] });
        }
        get()._advance();
      },
      skipRest: () => {
        if (get().status === 'resting') get()._advance();
      },
      skipExercise: () => {
        if (['exercising', 'rep_based_pause'].includes(get().status)) get()._advance();
      },
    }),
    {
      name: 'workout-engine-storage',
      partialize: (state) => 
        Object.fromEntries(
            Object.entries(state).filter(([key]) => !['status'].includes(key))
        ),
    }
  )
);
