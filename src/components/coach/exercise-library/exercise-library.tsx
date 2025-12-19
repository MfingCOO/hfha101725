'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getExercisesAction, deleteExerciseAction } from '@/app/coach/actions/workout-actions';
import { CreateExerciseDialog } from '@/app/coach/components/create-exercise-dialog';
import { Exercise } from '@/types/workout-program';
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

export function ExerciseLibrary() {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

    const fetchExercises = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getExercisesAction();
            if (result.success) {
                setExercises(result.data);
            } else if ('error' in result) {
                toast.error(result.error || 'Failed to fetch exercises.');
            }
        } catch (error) {
            toast.error('An unexpected error occurred while fetching exercises.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExercises();
    }, [fetchExercises]);

    const handleOpenDialogForCreate = () => {
        setEditingExercise(null);
        setIsDialogOpen(true);
    };

    const handleOpenDialogForEdit = (exercise: Exercise) => {
        setEditingExercise(exercise);
        setIsDialogOpen(true);
    };

    const handleDelete = async (exerciseId: string) => {
        const result = await deleteExerciseAction(exerciseId);
        if (result.success) {
            toast.success("Exercise deleted successfully.");
            fetchExercises();
        } else if ('error' in result) {
            toast.error(result.error || 'Failed to delete exercise.');
        }
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setEditingExercise(null);
    }

    const handleExerciseSaved = () => {
        fetchExercises();
        handleDialogClose();
    };

    return (
        <div className="p-4 border rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Shared Exercise Library</h3>
                <Button size="sm" onClick={handleOpenDialogForCreate}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Exercise
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : exercises.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                    <p>No exercises found.</p>
                    <p className="text-sm">Click "New Exercise" to create the first one.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {exercises.map(exercise => (
                        <div key={exercise.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                            <div className="flex-1">
                                <p className="font-semibold">{exercise.name}</p>
                                <p className="text-sm text-muted-foreground">{exercise.bodyParts.join(', ')}</p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDialogForEdit(exercise)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(exercise.id)} className="text-red-500">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            )}

            <CreateExerciseDialog
                isOpen={isDialogOpen}
                onClose={handleDialogClose}
                onExerciseSaved={handleExerciseSaved}
                exerciseToEdit={editingExercise}
            />
        </div>
    );
}
