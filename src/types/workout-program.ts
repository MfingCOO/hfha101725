
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
    metric?: 'reps' | 'time' | 'distance';
    value?: string;  
    weight?: string; 
}

export interface ExerciseBlock extends BaseBlock {
  type: 'exercise';
  exerciseId: string;
  sets: Set[];
  restBetweenSets?: string;
  notes?: string;
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
  programId?: string; // CORRECTED: Added programId to the workout type
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
