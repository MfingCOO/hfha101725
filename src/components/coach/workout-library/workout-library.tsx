'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getWorkoutsAction, deleteWorkoutAction, ActionResponse } from '@/app/coach/actions/workout-actions';
import { CreateWorkoutDialog } from '@/components/coach/workout-library/create-workout-dialog';
import { Workout } from '@/types/workout-program';
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

export function WorkoutLibrary() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

    const fetchWorkouts = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getWorkoutsAction();
            if (!result.success) {
                // This is the safe way to access the error property on a discriminated union
                if ('error' in result) {
                    toast.error(result.error || 'Failed to fetch workouts.');
                }
                return;
            }
            setWorkouts(result.data);
        } catch (error) {
            toast.error('An unexpected error occurred while fetching workouts.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkouts();
    }, [fetchWorkouts]);

    const handleOpenDialogForCreate = () => {
        setEditingWorkout(null);
        setIsDialogOpen(true);
    };

    const handleOpenDialogForEdit = (workout: Workout) => {
        setEditingWorkout(workout);
        setIsDialogOpen(true);
    };

    const handleDelete = async (workoutId: string) => {
        const result = await deleteWorkoutAction(workoutId);
        if (!result.success) {
            // This is the safe way to access the error property on a discriminated union
            if ('error' in result) {
                toast.error(result.error || 'Failed to delete workout.');
            }
            return;
        }
        toast.success("Workout deleted successfully.");
        fetchWorkouts();
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingWorkout(null);
    }

    const handleWorkoutSaved = () => {
        fetchWorkouts();
        handleDialogClose();
    };

    return (
        <div className="p-4 border rounded-lg mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Shared Workout Library</h3>
                <Button size="sm" onClick={handleOpenDialogForCreate}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Workout
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : workouts.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                    <p>No workouts found.</p>
                    <p className="text-sm">Click "New Workout" to create the first one.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {workouts.map(workout => (
                        <div key={workout.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                            <div className="flex-1">
                                <p className="font-semibold">{workout.name}</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{workout.description}</p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDialogForEdit(workout)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(workout.id)} className="text-red-500">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            )}

            <CreateWorkoutDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                onWorkoutSaved={handleWorkoutSaved}
                workoutToEdit={editingWorkout}
            />
        </div>
    );
}
