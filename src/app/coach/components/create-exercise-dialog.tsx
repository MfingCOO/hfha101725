'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import { createExerciseAction, updateExerciseAction } from "@/app/coach/actions/workout-actions";
import { Exercise } from "@/types/workout-program";

// --- Re-declaring the ActionResponse type for casting ---
type ErrorResponse = { success: false; error: string };

const exerciseSchema = z.object({
  name: z.string().min(1, "Exercise name is required."),
  description: z.string().min(1, "Description is required."),
  bodyParts: z.string().min(1, "Please list at least one body part, separated by commas."),
  equipmentNeeded: z.string().min(1, "Equipment is required."),
  trackingMetrics: z.array(z.string()).min(1, "At least one metric must be selected."),
  mediaUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal("")),
});

type ExerciseFormValues = z.infer<typeof exerciseSchema>;

interface CreateExerciseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExerciseSaved: () => void;
  coachId: string;
  exerciseToEdit: Exercise | null;
}

const TRACKING_METRICS_OPTIONS = ["reps", "weight", "time", "distance"];

export function CreateExerciseDialog({ isOpen, onClose, onExerciseSaved, coachId, exerciseToEdit }: CreateExerciseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = !!exerciseToEdit;

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      name: "",
      description: "",
      bodyParts: "",
      equipmentNeeded: "",
      trackingMetrics: [],
      mediaUrl: "",
    },
  });

  useEffect(() => {
    if (isEditMode && exerciseToEdit) {
        form.reset({
            name: exerciseToEdit.name,
            description: exerciseToEdit.description || '',
            bodyParts: Array.isArray(exerciseToEdit.bodyParts) ? exerciseToEdit.bodyParts.join(', ') : '',
            equipmentNeeded: exerciseToEdit.equipmentNeeded,
            trackingMetrics: exerciseToEdit.trackingMetrics,
            mediaUrl: exerciseToEdit.mediaUrl || ''
        });
    } else {
        form.reset({
            name: "",
            description: "",
            bodyParts: "",
            equipmentNeeded: "",
            trackingMetrics: [],
            mediaUrl: "",
        });
    }
  }, [exerciseToEdit, form, isEditMode]);

  const onSubmit = async (data: ExerciseFormValues) => {
    setIsLoading(true);
    const bodyPartsArray = data.bodyParts.split(",").map(part => part.trim()).filter(Boolean);

    const exerciseData = {
        ...data,
        bodyParts: bodyPartsArray,
        trackingMetrics: data.trackingMetrics as Array<'reps' | 'weight' | 'time' | 'distance'>,
    };

    const result = isEditMode && exerciseToEdit
      ? await updateExerciseAction({ exerciseId: exerciseToEdit.id, exerciseData })
      : await createExerciseAction({ coachId, exerciseData });

    setIsLoading(false);

    if (!result.success) {
      // Forcefully casting the type to make TypeScript understand
      toast.error((result as ErrorResponse).error);
      return;
    }

    toast.success(`Exercise has been ${isEditMode ? 'updated' : 'created'}.`);
    onExerciseSaved();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Exercise' : 'Create New Exercise'}</DialogTitle>
          <DialogDescription>
            Define a new exercise for your library. This can be reused in multiple workouts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={isLoading} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exercise Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Barbell Squat" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Textarea placeholder="Describe the exercise form and instructions..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bodyParts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Parts (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Quadriceps, Glutes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipmentNeeded"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Barbell, Dumbbells" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trackingMetrics"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Metrics to Track</FormLabel>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {TRACKING_METRICS_OPTIONS.map((metric) => (
                        <FormField
                          key={metric}
                          control={form.control}
                          name="trackingMetrics"
                          render={({ field }) => (
                            <FormItem
                              key={metric}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(metric)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), metric])
                                      : field.onChange(
                                          field.value?.filter((value) => value !== metric)
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal capitalize">
                                {metric}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mediaUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Media URL (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., https://www.youtube.com/watch?v=..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (isEditMode ? 'Saving Changes...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Exercise')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
