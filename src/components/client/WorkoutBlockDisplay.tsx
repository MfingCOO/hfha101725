'use client';

import { WorkoutBlock, Exercise, ExerciseBlock, GroupBlock } from '@/types/workout-program';
import { Dumbbell, Timer, Repeat, Info } from 'lucide-react';

interface WorkoutBlockDisplayProps {
  block: WorkoutBlock;
  exerciseDetails: Map<string, Exercise>;
}

// A helper to render the details of a single exercise block
const ExerciseDisplay = ({ block, exerciseDetails }: { block: ExerciseBlock, exerciseDetails: Map<string, Exercise> }) => {
    const exercise = exerciseDetails.get(block.exerciseId);
    if (!exercise) return <div className="p-2 text-sm text-muted-foreground">Exercise not found.</div>;

    return (
        <div className="p-3 rounded-md bg-background">
            <p className="font-semibold text-primary">{exercise.name}</p>
            {block.notes && (
                 <p className="text-xs text-muted-foreground flex items-center mb-2"><Info className="h-3 w-3 mr-2"/>{block.notes}</p>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className='text-muted-foreground'>
                            <th className="py-1 pr-2 font-normal">Set</th>
                            <th className="py-1 px-2 font-normal">Reps</th>
                            <th className="py-1 pl-2 font-normal">Weight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {block.sets?.map((set, index) => (
                            <tr key={set.id} className="border-t border-muted">
                                <td className="py-2 pr-2 font-medium">{index + 1}</td>
                                <td className="py-2 px-2">{set.value || '-'}</td>
                                <td className="py-2 pl-2">{set.weight || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export function WorkoutBlockDisplay({ block, exerciseDetails }: WorkoutBlockDisplayProps) {
  switch (block.type) {
    case 'exercise':
      return <ExerciseDisplay block={block} exerciseDetails={exerciseDetails} />;

    case 'rest':
      return (
        <div className="p-3 rounded-md bg-muted/30 flex items-center justify-center">
            <Timer className="h-5 w-5 mr-3 text-gray-400" />
            <span className="font-semibold text-muted-foreground">Rest: {block.duration} seconds</span>
        </div>
      );

    case 'group':
        const groupBlock = block as GroupBlock;
        return (
            <div className="p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center mb-2">
                    <Repeat className="h-5 w-5 mr-3 text-primary"/>
                    <div className='flex-1'>
                        <p className="font-bold text-primary">{groupBlock.name}</p>
                        <p className='text-sm text-muted-foreground'>{groupBlock.rounds} Rounds</p>
                    </div>
                </div>
                <div className="space-y-2 pl-4 border-l-2 border-primary/50 ml-2">
                    {groupBlock.blocks.map((exBlock, index) => (
                        <div key={exBlock.id}>
                            <ExerciseDisplay block={exBlock} exerciseDetails={exerciseDetails} />
                            {index < groupBlock.blocks.length - 1 && groupBlock.restBetweenRounds && (
                               <div className="py-2 flex items-center justify-center">
                                    <Timer className="h-4 w-4 mr-2 text-gray-400" />
                                    <span className="text-xs font-semibold text-muted-foreground">{groupBlock.restBetweenRounds}s rest</span>
                               </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );

    default:
      return <div className="p-2 text-sm">Unknown block type.</div>;
  }
}
