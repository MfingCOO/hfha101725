import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { WorkoutBlock, GroupBlock } from '@/types/workout-program';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively extracts all unique exercise IDs from a list of workout blocks.
 * This is used to gather all exercises that need to be fetched for a workout.
 * @param blocks - An array of WorkoutBlock objects.
 * @returns An array of unique exercise ID strings.
 */
export function extractExerciseIds(blocks: WorkoutBlock[]): string[] {
  const exerciseIds = new Set<string>();

  function recurse(currentBlocks: WorkoutBlock[]) {
    for (const block of currentBlocks) {
      if (block.type === 'exercise') {
        exerciseIds.add(block.exerciseId);
      } else if (block.type === 'group') {
        // If it's a group, recurse into its nested blocks
        recurse((block as GroupBlock).blocks);
      }
    }
  }

  recurse(blocks);
  return Array.from(exerciseIds);
}
