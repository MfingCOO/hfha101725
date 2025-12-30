'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Workout, Exercise, ExerciseBlock, RestBlock, GroupBlock } from "@/types/workout-program";
import { getExercisesByIdsAction } from '@/app/exercises/actions';
import { extractExerciseIds } from '@/lib/utils';
import { Loader2, History } from 'lucide-react';
import { RPE_SCALE } from '@/lib/rpe-scale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserProfile } from '@/types';
import { WorkoutHistoryDialog } from './WorkoutHistoryDialog';

interface WorkoutOverviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
  userProfile: UserProfile | null;
}

export function WorkoutOverviewDialog({ isOpen, onClose, workout, userProfile }: WorkoutOverviewDialogProps) {
  const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (isOpen && workout && !isHistoryOpen) {
      const fetchExercises = async () => {
        setIsLoading(true);
        const exerciseIds = extractExerciseIds(workout);
        if (exerciseIds.length > 0) {
          const result = await getExercisesByIdsAction(exerciseIds);
          if (result.success) {
            setExercises(new Map(result.data.map(ex => [ex.id, ex])));
          } 
        }
        setIsLoading(false);
      };
      fetchExercises();
    }
  }, [isOpen, workout, isHistoryOpen]);

  const handleOpenHistory = () => {
      if(workout) {
          setIsHistoryOpen(true);
      }
  }

  const renderBlock = (block: any, index: number) => {
    const key = `${block.id}-${index}`;
    switch (block.type) {
      case 'exercise':
        const exercise = exercises.get((block as ExerciseBlock).exerciseId);
        if (!exercise) return <div key={key} className="p-3 rounded-md bg-muted/30">Loading exercise...</div>;
        return <ExerciseBlockView key={key} block={block as ExerciseBlock} exercise={exercise} />;
      case 'rest':
        return <RestBlockView key={key} block={block as RestBlock} />;
      case 'group':
         return <GroupBlockView key={key} block={block as GroupBlock} exercises={exercises} />;
      default:
        return null;
    }
  };

  return (
      <>
        <Dialog open={isOpen && !isHistoryOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-xl h-[80vh] flex flex-col">
            <DialogHeader>
            <DialogTitle>{workout?.name || 'Workout Overview'}</DialogTitle>
            <DialogDescription>{workout?.description || 'Review the details of this workout.'}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3">
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-3">
                {workout?.blocks.map(renderBlock)}
                </div>
            )}
            </ScrollArea>

            <DialogFooter className="pt-4 border-t mt-auto">
                <Button variant="secondary" onClick={handleOpenHistory}><History className="h-4 w-4 mr-2"/>View History</Button>
                <Button onClick={onClose}>Close</Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>

        {workout && userProfile && (
            <WorkoutHistoryDialog 
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                workoutId={workout.id}
                userId={userProfile.uid}
                workoutName={workout.name}
            />
        )}
    </>
  );
}


// Sub-components for rendering different block types

const ExerciseBlockView = ({ block, exercise }: { block: ExerciseBlock, exercise: Exercise }) => {
    const isWeightTracked = exercise.trackingMetrics.includes('weight');
    return (
        <div className="p-3 rounded-md bg-muted/50">
            <h4 className="font-semibold text-lg">{exercise.name}</h4>
            <p className="text-sm text-muted-foreground mb-2">{exercise.description}</p>
            <div className="space-y-1 text-sm">
                {block.sets.map((set, index) => {
                    const rpeInfo = RPE_SCALE.find(r => r.value === set.rpe);
                    const rpeDescription = rpeInfo ? (isWeightTracked ? rpeInfo.lifting : rpeInfo.running) : '';
                    return (
                        <div key={set.id || index} className="grid grid-cols-4 gap-2 items-center">
                            <span className="font-medium">Set {index + 1}</span>
                            <span>{set.value} {set.metric}</span>
                            {set.rpe !== undefined && <span className="col-span-2">RPE {set.rpe}: <i className="text-muted-foreground">{rpeDescription}</i></span>}
                        </div>
                    )
                })}
            </div>
            {block.restBetweenSets && <p className="text-sm mt-2">Rest: {block.restBetweenSets} seconds</p>}
        </div>
    )
}

const RestBlockView = ({ block }: { block: RestBlock }) => (
  <div className="p-3 rounded-md bg-yellow-900/30 text-center">
    <p className="font-semibold">Rest: {block.duration} seconds</p>
  </div>
);

const GroupBlockView = ({ block, exercises }: { block: GroupBlock, exercises: Map<string, Exercise> }) => (
    <div className="p-3 rounded-md border border-primary/40 bg-slate-900/50">
        <h4 className="font-bold text-lg mb-2">{block.name} - {block.rounds} Rounds</h4>
        <div className="space-y-3">
            {block.blocks.map((exBlock, index) => {
                const exercise = exercises.get(exBlock.exerciseId);
                if (!exercise) return <div key={index}>Loading...</div>
                return <ExerciseBlockView key={index} block={exBlock} exercise={exercise} />
            })}
        </div>
        {block.restBetweenRounds && <p className="text-sm mt-2 font-semibold text-center">{block.restBetweenRounds}s rest between rounds</p>}
    </div>
)
