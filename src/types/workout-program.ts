
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

// Represents a single set within an exercise, e.g., "10 reps at 50kg".
export interface Set {
    id: string;
    metric?: 'reps' | 'time' | 'distance'; // The primary metric for the set
    value?: string;   // The target value for the metric (e.g., '10', '60s')
    weight?: string;  // The weight to be used, if applicable
}

export interface ExerciseBlock extends BaseBlock {
  type: 'exercise';
  exerciseId: string; // Reference to an Exercise in the library
  sets: Set[]; // An array of sets to be performed
  restBetweenSets?: string; // e.g., '60'
  notes?: string; // Coach's notes for this specific step
}

export interface RestBlock extends BaseBlock {
  type: 'rest';
  duration: number; // in seconds
}

export interface GroupBlock extends BaseBlock {
  type: 'group';
  name: string; // e.g., "Superset" or "Circuit"
  rounds: number; // How many times to repeat the group
  blocks: ExerciseBlock[]; // The exercises within the group
  restBetweenRounds?: number; // Optional rest in seconds after each round
}

export type WorkoutBlock = ExerciseBlock | RestBlock | GroupBlock;

export interface Workout {
  id: string;
  name: string;
  description: string;
  blocks: WorkoutBlock[];
  duration?: number; // Estimated duration in minutes
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
  startDate: string; // ISO date string
  completedWorkouts: {
    weekId: string;
    workoutId: string;
    completedAt: string; // ISO date string
  }[];
}
