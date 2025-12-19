'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { getExercisesForCoach, deleteExerciseAction } from '@/app/coach/actions/workout-actions';
import { CreateExerciseDialog } from '@/app/coach/components/create-exercise-dialog';
import { Exercise } from '@/types/workout-program';
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2, Search } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

// --- Re-declaring the ActionResponse type for casting ---
type ErrorResponse = { success: false; error: string };

interface ExerciseLibraryProps {
  coachId: string;
}

export function ExerciseLibrary({ coachId }: ExerciseLibraryProps) {
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

    // --- State for filtering ---
    const [searchTerm, setSearchTerm] = useState('');

    const fetchExercises = useCallback(async () => {
        if (!coachId) return;
        setIsLoading(true);
        try {
            const result = await getExercisesForCoach(coachId);
            if (!result.success) {
                // Forcefully casting the type to make TypeScript understand
                toast.error((result as ErrorResponse).error);
                return;
            }
            setAllExercises(result.data);
        } catch (error) {
            toast.error('An unexpected error occurred while fetching exercises.');
        } finally {
            setIsLoading(false);
        }
    }, [coachId]);

    useEffect(() => {
        fetchExercises();
    }, [fetchExercises]);

    const filteredExercises = useMemo(() => {
        if (!searchTerm) {
            return allExercises;
        }
        return allExercises.filter(exercise =>
            exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allExercises, searchTerm]);

    const handleOpenDialogForCreate = () => {
        setEditingExercise(null);
        setIsDialogOpen(true);
    };

    const handleOpenDialogForEdit = (exercise: Exercise) => {
        setEditingExercise(exercise);
        setIsDialogOpen(true);
    };

    const handleDelete = async (exerciseId: string) => {
        if (!window.confirm('Are you sure you want to delete this exercise?')) {
            return;
        }

        const result = await deleteExerciseAction(exerciseId);
        if (!result.success) {
            // Forcefully casting the type to make TypeScript understand
            toast.error((result as ErrorResponse).error);
            return;
        }

        toast.success('Exercise deleted successfully!');
        fetchExercises();
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
        <div className="p-4 border rounded-lg mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Exercise Library</h3>
                <Button size="sm" onClick={handleOpenDialogForCreate}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Exercise
                </Button>
            </div>

            {/* --- Simplified Search Input --- */}
            <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search by exercise name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filteredExercises.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                    <p>No exercises found.</p>
                    <p className="text-sm">Try adjusting your search or create a new exercise.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredExercises.map(exercise => (
                        <div key={exercise.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                            <div className="flex-1">
                                <p className="font-semibold">{exercise.name}</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">{exercise.description}</p>
                                <p className="text-xs text-muted-foreground capitalize mt-1">
                                    <span className="font-medium">Body Parts:</span> {Array.isArray(exercise.bodyParts) ? exercise.bodyParts.join(', ') : 'N/A'}
                                </p>
                                 <p className="text-xs text-muted-foreground capitalize mt-1">
                                    <span className="font-medium">Equipment:</span> {exercise.equipmentNeeded}
                                </p>
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

            {coachId && (
                <CreateExerciseDialog
                    isOpen={isDialogOpen}
                    onClose={handleDialogClose}
                    onExerciseSaved={handleExerciseSaved}
                    coachId={coachId}
                    exerciseToEdit={editingExercise}
                />
            )}
        </div>
    );
}
