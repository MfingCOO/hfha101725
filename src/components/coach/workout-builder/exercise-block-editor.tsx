'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Trash2, PlusCircle } from 'lucide-react';
import { Exercise } from '@/types/workout-program';
import { v4 as uuidv4 } from 'uuid';

interface ExerciseBlockEditorProps {
  fieldPrefix: string;
  removeBlock: () => void;
  availableExercises: Exercise[];
}

const METRIC_OPTIONS = ['reps', 'time', 'distance'];

export function ExerciseBlockEditor({ fieldPrefix, removeBlock, availableExercises }: ExerciseBlockEditorProps) {
  const { control } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldPrefix}.sets`,
  });

  const addSet = () => {
    append({ id: uuidv4(), metric: 'reps', value: '10', weight: '' });
  };

  return (
    <Card className="w-full bg-slate-900/50 border-primary/20">
      <CardContent className="p-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-grow">
             <FormField
              control={control}
              name={`${fieldPrefix}.exerciseId`}
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select an exercise..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableExercises.map(ex => (
                        <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name={`${fieldPrefix}.restBetweenSets`}
            render={({ field }) => (
              <FormItem className="w-32 flex-shrink-0">
                  <div className="relative">
                     <Input {...field} placeholder="Rest" className="h-9 pr-8" />
                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">sec</span>
                  </div>
              </FormItem>
            )}
          />

          <Button type="button" variant="ghost" size="icon" onClick={removeBlock} className="h-9 w-9 flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-x-2 px-1 pb-1 text-xs font-semibold text-muted-foreground">
            <div className="col-span-1">Set</div>
            <div className="col-span-4">Metric</div>
            <div className="col-span-3">Value</div>
            <div className="col-span-3">Weight</div>
            <div className="col-span-1"></div>
        </div>

        <div className="space-y-1">
          {fields.map((set, setIndex) => (
            <div key={set.id} className="grid grid-cols-12 items-center gap-x-2">
              <p className="text-center font-bold col-span-1">{setIndex + 1}</p>

              <div className="col-span-4">
                <FormField
                  control={control}
                  name={`${fieldPrefix}.sets.${setIndex}.metric`}
                  render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Metric" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {METRIC_OPTIONS.map(opt => <SelectItem key={opt} value={opt} className="capitalize text-xs">{opt}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  )}
                />
              </div>

              <div className="col-span-3">
                 <FormField control={control} name={`${fieldPrefix}.sets.${setIndex}.value`} render={({ field }) => <Input {...field} className="h-8 text-center" />} />
              </div>

              <div className="col-span-3">
                 <FormField control={control} name={`${fieldPrefix}.sets.${setIndex}.weight`} render={({ field }) => <Input {...field} placeholder="e.g., 50 or 80%" className="h-8 text-center" />} />
              </div>
              
              <div className="col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(setIndex)} className="h-8 w-8">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
         <Button type="button" variant="outline" size="sm" onClick={addSet} className="mt-2 w-full h-8">
            <PlusCircle className="h-4 w-4 mr-2" /> Add Set
        </Button>

      </CardContent>
    </Card>
  );
}
