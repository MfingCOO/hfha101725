
export interface Exercise {
  id: string; // Unique identifier
  coachId: string; // Reference to the coach who created it
  name: string;
  description: string; // Detailed instructions for the exercise
  bodyParts: string[]; // e.g., ["Quadriceps", "Glutes", "Hamstrings"]
  equipmentNeeded: string; // e.g., "Barbell", "Treadmill", "None (Bodyweight)"
  trackingMetrics: Array<'reps' | 'weight' | 'time' | 'distance'>;
  mediaUrl?: string; // Optional link to a demonstration video or image
}

// --- New Advanced Workout Structures ---

export type WorkoutBlockType = 'exercise' | 'rest' | 'group';

export interface BaseBlock {
  id: string; // Unique ID for each block within a workout
  type: WorkoutBlockType;
}

export interface ExerciseBlock extends BaseBlock {
  type: 'exercise';
  exerciseId: string; // Reference to an Exercise in the library
  // Details for this specific instance of the exercise
  sets?: number;
  reps?: number;
  weight?: number;
  time?: number; // in seconds
  distance?: number; // in meters
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
  id: string; // Unique identifier
  coachId: string; // Reference to the creator
  name: string; // e.g., "Leg Day - Volume", "HIIT Cardio Blast"
  description: string;
  // The ordered list of blocks that make up the workout
  blocks: WorkoutBlock[];
}

// --- Program & User Program Structures (remain the same) ---

export interface Program {
  id: string; // Unique identifier
  coachId: string; // Reference to the creator
  name: string; // e.g., "8-Week Strength Foundation"
  description: string;
  workouts: Array<{ // An ordered list defining the schedule
    day: number;
    workoutId: string;
  }>;
}

// To track user subscriptions to programs
export interface UserProgram {
  userId: string;
  programId: string;
  startDate: string; // ISO date string
}
