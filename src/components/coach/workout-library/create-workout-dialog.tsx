'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

import { Exercise, Workout } from "@/types/workout-program";
import { createWorkoutAction, updateWorkoutAction, getExercisesForCoach } from "@/app/coach/actions/workout-actions";
import { PlusCircle } from 'lucide-react';
import { ExerciseBlockEditor } from '../workout-builder/exercise-block-editor';
import { RestBlockEditor } from '../workout-builder/rest-block-editor';
import { GroupBlockEditor } from '../workout-builder/group-block-editor';

type ErrorResponse = { success: false; error: string };

const setSchema = z.object({
  id: z.string().optional(),
  metric: z.string().optional(),
  value: z.string().optional(),
  weight: z.string().optional(),
});

const exerciseBlockSchema = z.object({
  id: z.string(),
  type: z.literal('exercise'),
  exerciseId: z.string().min(1, "Exercise must be selected"),
  sets: z.array(setSchema).min(1, "At least one set is required"),
  restBetweenSets: z.string().optional(),
});

const restBlockSchema = z.object({
  id: z.string(),
  type: z.literal('rest'),
  duration: z.number().min(1, "Duration must be at least 1 second"),
});

const groupBlockSchema = z.object({
  id: z.string(),
  type: z.literal('group'),
  name: z.string().min(1, "Group name is required"),
  rounds: z.number().min(1, "Must have at least 1 round"),
  restBetweenRounds: z.number().min(0).optional(),
  blocks: z.array(z.lazy(() => exerciseBlockSchema)).min(1, "A group must contain at least one exercise"),
});

const workoutBlockSchema = z.union([
  exerciseBlockSchema,
  restBlockSchema,
  groupBlockSchema,
]);

const workoutFormSchema = z.object({
  name: z.string().min(2, "Workout name is required."),
  description: z.string().optional(),
  blocks: z.array(workoutBlockSchema).min(1, "A workout must have at least one block."),
});

type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

interface CreateWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutSaved: () => void;
  coachId: string;
  workoutToEdit: Workout | null;
}

export function CreateWorkoutDialog({ isOpen, onClose, onWorkoutSaved, coachId, workoutToEdit }: CreateWorkoutDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const isEditMode = !!workoutToEdit;

    const methods = useForm<WorkoutFormValues>({
        resolver: zodResolver(workoutFormSchema),
        defaultValues: {
            name: '',
            description: '',
            blocks: [],
        }
    });

    const { control, handleSubmit, reset, formState: { isValid } } = methods;

    const { fields, append, remove } = useFieldArray({
        control,
        name: "blocks",
    });

    useEffect(() => {
        if (isOpen && coachId) {
            getExercisesForCoach(coachId).then(result => {
                if (!result.success) {
                    toast.error((result as ErrorResponse).error);
                    return;
                }
                setAvailableExercises(result.data);
            });
        }
    }, [isOpen, coachId]);

    useEffect(() => {
        if (isEditMode && workoutToEdit) {
            reset(workoutToEdit as any);
        } else {
            reset({ name: '', description: '', blocks: [] });
        }
    }, [workoutToEdit, isEditMode, reset]);

    const onSubmit = async (data: WorkoutFormValues) => {
        setIsLoading(true);
        const action = isEditMode
            ? updateWorkoutAction({ workoutId: workoutToEdit!.id, workoutData: data })
            : createWorkoutAction({ coachId, workoutData: data });

        const result = await action;
        setIsLoading(false);

        if (!result.success) {
            toast.error((result as any).error);
            return;
        }

        toast.success(`Workout ${isEditMode ? 'updated' : 'created'} successfully!`);
        onWorkoutSaved();
    };

    const addExerciseBlock = () => {
        if (availableExercises.length === 0) {
            toast.error("You must have at least one exercise in your library.");
            return;
        }
        append({ id: uuidv4(), type: 'exercise', exerciseId: availableExercises[0].id, sets: [{ id: uuidv4(), metric: 'reps', value: '10', weight: '' }], restBetweenSets: '60' });
    };

    const addRestBlock = () => {
        append({ id: uuidv4(), type: 'rest', duration: 60 });
    };

    const addGroupBlock = () => {
        if (availableExercises.length === 0) {
            toast.error("You must have at least one exercise in your library to create a superset.");
            return;
        }
        append({
            id: uuidv4(),
            type: 'group',
            name: 'New Superset',
            rounds: 3,
            blocks: [{
                id: uuidv4(),
                type: 'exercise',
                exerciseId: availableExercises[0].id,
                sets: [{ id: uuidv4(), metric: 'reps', value: '10', weight: '' }],
                restBetweenSets: '60'
            }]
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl h-[90vh] flex flex-col p-2">
                <DialogHeader className="p-1">
                    <DialogTitle>{isEditMode ? 'Edit Workout' : 'Create New Workout'}</DialogTitle>
                </DialogHeader>

                <FormProvider {...methods}>
                    <Form {...methods}>
                        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 space-y-2">
                            <div className="grid grid-cols-2 gap-2 px-1">
                                <FormField control={control} name="name" render={({ field }) => <FormItem><FormControl><Input placeholder="Workout Name" {...field} className="h-9"/></FormControl><FormMessage /></FormItem>} />
                                <FormField control={control} name="description" render={({ field }) => <FormItem><FormControl><Input placeholder="Description (optional)" {...field} className="h-9"/></FormControl><FormMessage /></FormItem>} />
                            </div>

                            <div className="flex-1 border-2 border-dashed rounded-lg p-1 bg-muted/50 overflow-y-auto space-y-2">
                                {fields.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <p className="text-center text-muted-foreground py-10">Your workout is empty.</p>
                                     </div>
                                ) : (
                                    fields.map((field, index) => {
                                        const block = field as any;
                                        switch (block.type) {
                                            case 'exercise':
                                                return <ExerciseBlockEditor key={field.id} fieldPrefix={`blocks.${index}`} removeBlock={() => remove(index)} availableExercises={availableExercises} />;
                                            case 'rest':
                                                return <RestBlockEditor key={field.id} blockIndex={index} removeBlock={remove} />;
                                            case 'group':
                                                return <GroupBlockEditor key={field.id} blockIndex={index} removeBlock={remove} coachId={coachId} availableExercises={availableExercises} />;
                                            default:
                                                return null;
                                        }
                                    })
                                )}
                            </div>

                            <div className="flex items-center justify-center gap-2 pt-1 border-t">
                                <Button type="button" variant="outline" size="sm" onClick={addExerciseBlock}><PlusCircle className="h-4 w-4 mr-2"/>Exercise</Button>
                                <Button type="button" variant="outline" size="sm" onClick={addRestBlock}><PlusCircle className="h-4 w-4 mr-2"/>Rest</Button>
                                <Button type="button" variant="outline" size="sm" onClick={addGroupBlock}><PlusCircle className="h-4 w-4 mr-2"/>Superset</Button>
                            </div>
                            
                            <DialogFooter className="p-0 pt-1">
                                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                                <Button type="submit" disabled={isLoading || !isValid}>{isLoading ? 'Saving...' : 'Save Workout'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
