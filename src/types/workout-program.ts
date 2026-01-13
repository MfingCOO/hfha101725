
export interface Exercise {
  id: string;
  name: string;
  description: string;
  bodyParts: string[];
  equipmentNeeded: string;
  trackingMetrics: Array<'reps' | 'weight' | 'time' | 'distance'>;
  mediaUrl?: string;
}

// --- Workout Structures ---

export type WorkoutBlockType = 'exercise' | 'rest' | 'group';

export interface BaseBlock {
  id: string;
  type: WorkoutBlockType;
}

export interface Set {
    id: string;
    metric?: 'reps' | 'time' | 'distance' | 'weight';
    value?: string;
    target?: string; // Replaces RPE for a flexible target
    targetWeight?: string;
    weight?: string;
}

export interface ExerciseBlock extends BaseBlock {
  type: 'exercise';
  exerciseId: string;
  sets: Set[];
  restBetweenSets?: string;
  notes?: string;
  // LAZER-FOCUSED CHANGE 1: Add optional metadata to the exercise block.
  // This allows the engine to "tag" an exercise with its superset context.
  // The player will look for this information. It's optional to prevent any side effects.
  groupInfo?: {
    name: string;
    currentRound: number;
    totalRounds: number;
    exerciseIndex: number;
    totalExercises: number;
  };
}

export interface RestBlock extends BaseBlock {
  type: 'rest';
  duration: number; // in seconds
}

export interface GroupBlock extends BaseBlock {
  type: 'group';
  name: string;
  rounds: number;
  blocks: ExerciseBlock[];
  restBetweenRounds?: number;
}

export type WorkoutBlock = ExerciseBlock | RestBlock | GroupBlock;

export interface Workout {
  id: string;
  name: string;
  description: string;
  blocks: WorkoutBlock[];
  duration?: number; // Estimated duration in minutes
  programId?: string;
}

// --- Program Structures ---

export interface ProgramWeek {
  id: string;
  weekNumber: number;
  name: string;
  workoutIds: string[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: number | 'continuous';
  weeks: ProgramWeek[];
}

export interface UserProgram {
  userId: string;
  programId: string;
  startDate: string;
  completedWorkouts: {
    weekId: string;
    workoutId: string;
    completedAt: string;
  }[];
}

// --- Performance Logging ---
export interface PerformanceLog {
  id?: string;
  userId: string;
  workoutId: string;
  programId: string | null;
  completedAt: Date;
  duration: number; // in seconds
  performance: {
      blockId: string;
      setIndex: number;
      reps: number;
      weight: number;
  }[];
}
