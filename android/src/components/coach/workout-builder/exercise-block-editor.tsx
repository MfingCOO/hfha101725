'use client';

import { useState, useMemo } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
// SURGICAL FIX: Re-add the Select components that were accidentally removed.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField, FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Trash2, PlusCircle, ChevronsUpDown } from 'lucide-react';
import { Exercise } from '@/types/workout-program';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

interface ExerciseBlockEditorProps {
  fieldPrefix: string;
  removeBlock: () => void;
  availableExercises: Exercise[];
}

const METRIC_OPTIONS = ['reps', 'time', 'distance', 'weight'];

export function ExerciseBlockEditor({ fieldPrefix, removeBlock, availableExercises }: ExerciseBlockEditorProps) {
  const { control } = useFormContext();
  const [open, setOpen] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: `${fieldPrefix}.sets`,
  });

  const addSet = () => {
    append({ id: uuidv4(), metric: 'reps', value: '10', target: '' });
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
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between h-9"
                        >
                          {field.value
                            ? availableExercises.find(ex => ex.id === field.value)?.name
                            : "Select an exercise..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search exercise..." />
                        <CommandList>
                          <CommandEmpty>No exercise found.</CommandEmpty>
                          <CommandGroup>
                            {availableExercises.map(ex => (
                              <CommandItem
                                key={ex.id}
                                value={ex.name}
                                onSelect={() => {
                                  field.onChange(ex.id);
                                  setOpen(false);
                                }}
                              >
                                {ex.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
          <div className="col-span-3">Target</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-1">
          {fields.map((set, setIndex) => (
            <div key={set.id} className="grid grid-cols-12 items-start gap-x-2">
              <p className="text-center font-bold col-span-1 pt-2">{setIndex + 1}</p>

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
                <FormField
                  control={control}
                  name={`${fieldPrefix}.sets.${setIndex}.target`}
                  render={({ field }) => <Input {...field} type="text" placeholder="e.g., 80% 1RM" className="h-8 text-xs" />}
                />
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
