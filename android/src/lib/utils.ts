import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Workout, WorkoutBlock } from "@/types/workout-program";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const paddedSeconds = String(remainingSeconds).padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
}

export const extractExerciseIds = (workout: Workout): string[] => {
    const ids = new Set<string>();

    const processBlock = (block: WorkoutBlock) => {
        if (block.type === 'exercise') {
            ids.add(block.exerciseId);
        } else if (block.type === 'group') {
            block.blocks.forEach(processBlock);
        }
    };

    workout.blocks.forEach(processBlock);

    return Array.from(ids);
};
