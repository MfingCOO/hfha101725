'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';

import { Exercise, Workout, WorkoutBlock, ExerciseBlock, RestBlock, GroupBlock } from "@/types/workout-program";
import { createWorkoutAction, updateWorkoutAction, getExercisesForCoach } from "@/app/coach/actions/workout-actions";
import { PlusCircle, GripVertical, Trash2 } from 'lucide-react';

// --- Zod Schemas for Validation ---
// These match the backend schemas
const exerciseBlockSchema = z.object({
  id: z.string(),
  type: z.literal('exercise'),
  exerciseId: z.string(),
  // Add other exercise-specific fields here
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
  blocks: z.array(exerciseBlockSchema).min(1, "A group must have at least one exercise"),
});

const workoutBlockSchema = z.union([
  exerciseBlockSchema,
  restBlockSchema,
  groupBlockSchema,
]);

const workoutFormSchema = z.object({
  name: z.string().min(1, "Workout name is required."),
  description: z.string().min(1, "Description is required."),
  blocks: z.array(workoutBlockSchema).min(1, "A workout must have at least one block."),
});

type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

// --- Component Props ---

interface CreateWorkoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutSaved: () => void;
  coachId: string;
  workoutToEdit: Workout | null;
}

// --- Main Component ---

export function CreateWorkoutDialog({ isOpen, onClose, onWorkoutSaved, coachId, workoutToEdit }: CreateWorkoutDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const isEditMode = !!workoutToEdit;

    const form = useForm<WorkoutFormValues>({
        resolver: zodResolver(workoutFormSchema),
        defaultValues: {
            name: '',
            description: '',
            blocks: [],
        }
    });

    const { fields, append, remove, move } = useFieldArray({
        control: form.control,
        name: "blocks",
    });

    // Fetch exercises coach can add to the workout
    useEffect(() => {
        if (isOpen && coachId) {
            getExercisesForCoach(coachId).then(result => {
                if (result.success && result.data) {
                    setAvailableExercises(result.data);
                } else {
                    toast.error("Could not load your exercises.");
                }
            });
        }
    }, [isOpen, coachId]);

    // Populate form if editing
    useEffect(() => {
        if (isEditMode && workoutToEdit) {
            form.reset({
                name: workoutToEdit.name,
                description: workoutToEdit.description,
                blocks: workoutToEdit.blocks as any[], // TODO: Fix type assertion
            });
        } else {
            form.reset({ name: '', description: '', blocks: [] });
        }
    }, [workoutToEdit, isEditMode, form]);

    const onSubmit = async (data: WorkoutFormValues) => {
        setIsLoading(true);
        // TODO: Implement save logic
        console.log("Form Data:", data);
        await new Promise(res => setTimeout(res, 1000)); // Simulate API call
        setIsLoading(false);
        toast.success("Workout saved (simulation)!");
        onWorkoutSaved();
    };

    // --- Render --- 

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Workout' : 'Create New Workout'}</DialogTitle>
                    <DialogDescription>
                        Build a workout by adding exercises, rest periods, and supersets.
                    </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                             <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Workout Name</FormLabel>
                                        <FormControl><Input placeholder="e.g., Upper Body Strength" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Input placeholder="A brief summary of the workout's focus." {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex-1 border-2 border-dashed rounded-lg p-4 bg-muted/50 overflow-y-auto">
                            <p className="text-center text-muted-foreground">
                                Workout canvas - drag and drop blocks here.
                            </p>
                            {/* Workout block rendering will go here */}
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <Button type="button" variant="outline" size="sm" disabled>
                                <PlusCircle className="h-4 w-4 mr-2"/> Add Exercise
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled>
                                <PlusCircle className="h-4 w-4 mr-2"/> Add Rest
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled>
                                <PlusCircle className="h-4 w-4 mr-2"/> Add Superset/Circuit
                            </Button>
                        </div>
                        
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Saving...' : 'Save Workout'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
