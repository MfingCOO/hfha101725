'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Trash2, PlusCircle } from 'lucide-react';
import { Exercise } from '@/types/workout-program';
import { ExerciseBlockEditor } from './exercise-block-editor'; 
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface GroupBlockEditorProps {
  blockIndex: number;
  removeBlock: (index: number) => void;
  availableExercises: Exercise[];
  coachId: string;
}

export function GroupBlockEditor({ blockIndex, removeBlock, availableExercises }: GroupBlockEditorProps) {
  const { control } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `blocks.${blockIndex}.blocks`,
  });

  const addExerciseToGroup = () => {
    if (availableExercises.length === 0) {
        toast.error("No exercises in library to add.");
        return;
    }
    append({ 
        id: uuidv4(), 
        type: 'exercise', 
        exerciseId: availableExercises[0].id, 
        restBetweenSets: '60', 
        sets: [{ id: uuidv4(), metric: 'reps', value: '10', weight: '' }]
    });
  };

  return (
    <Card className="w-full bg-slate-800/80 border-primary/30">
        <CardHeader className="flex-row flex items-center justify-between p-2">
            <div className="flex-grow">
                 <FormField
                    control={control}
                    name={`blocks.${blockIndex}.name`}
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input placeholder="e.g., Superset 1" {...field} className="text-md font-semibold bg-transparent border-0 h-8" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
             <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(blockIndex)} className="ml-2 h-8 w-8 flex-shrink-0">
                <Trash2 className="h-4 w-4" />
            </Button>
        </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
             <FormField
                    control={control}
                    name={`blocks.${blockIndex}.rounds`}
                    render={({ field }) => (
                        <FormItem>
                             <FormControl>
                                <Input type="number" placeholder="Rounds" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 1)} className="h-8" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
             <FormField
                    control={control}
                    name={`blocks.${blockIndex}.restBetweenRounds`}
                    render={({ field }) => (
                        <FormItem>
                             <FormControl>
                                <Input type="number" placeholder="Rest between rounds (s)" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} className="h-8" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
        </div>

        <div className="space-y-1 rounded-md bg-background/30 p-1">
            {fields.map((field, exerciseIndex) => (
                <ExerciseBlockEditor 
                    key={field.id}
                    fieldPrefix={`blocks.${blockIndex}.blocks.${exerciseIndex}`}
                    removeBlock={() => remove(exerciseIndex)} 
                    availableExercises={availableExercises} 
                />
            ))}
             <Button type="button" variant="outline" size="sm" onClick={addExerciseToGroup} className="mt-1 w-full h-8">
                <PlusCircle className="h-4 w-4 mr-2" /> Add Exercise
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
