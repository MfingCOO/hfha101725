'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCalendarEvent } from '@/app/calendar/actions';
import { deleteData } from '@/services/firestore';
import { triggerSummaryRecalculation } from '@/app/calendar/actions';
import { useToast } from '@/hooks/use-toast';
import type { ClientProfile } from '@/types';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface WorkoutActionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    event?: any;
    workoutId?: string;
    client: ClientProfile;
    onStart?: (workout: any) => void;
    onWorkoutStarted?: () => void; // Surgically Added
    onEdit?: (workout: any) => void;
    onViewHistory?: (workout: any) => void;
    onEntryChange?: () => void;
}

export function WorkoutActionDialog({ 
    isOpen, 
    onClose, 
    event, 
    workoutId,
    client,
    onStart, 
    onWorkoutStarted, // Surgically Added
    onEdit,
    onViewHistory,
    onEntryChange 
}: WorkoutActionDialogProps) {
    const { toast } = useToast();
    const [workout, setWorkout] = useState(event);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (event) {
            setWorkout(event);
            return;
        }

        if (isOpen && workoutId) {
            const fetchWorkout = async () => {
                setIsLoading(true);
                try {
                    const docRef = doc(db, 'scheduledWorkouts', workoutId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setWorkout({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        toast({ variant: 'destructive', title: 'Error', description: 'Workout not found.' });
                        onClose();
                    }
                } catch (error) {
                    console.error("Error fetching workout:", error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load workout details.' });
                    onClose();
                } finally {
                    setIsLoading(false);
                }
            };
            fetchWorkout();
        }
    }, [isOpen, workoutId, event, toast, onClose]);

    const handleDelete = async () => {
        if (!workout) return;
        setIsDeleting(true);

        const isCompleted = workout?.pillar === 'activity' && workout?.type === 'workout';
        let result: { success: boolean; error?: string };

        try {
            if (isCompleted) {
                result = await deleteData('activity', workout.id, client.uid);
                if (result.success) {
                    const dateString = new Date(workout.entryDate).toISOString().split('T')[0];
                    const timezoneOffset = new Date().getTimezoneOffset();
                    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    await triggerSummaryRecalculation(client.uid, dateString, userTimezone, timezoneOffset);
                }
            } else {
                result = await deleteCalendarEvent(workout.id);
            }

            if (result.success) {
                toast({ title: 'Workout Deleted', description: 'The workout has been removed.' });
                if(onEntryChange) onEntryChange();
            } else {
                throw new Error(result.error || 'Could not delete the workout.');
            }
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsDeleting(false);
            onClose();
        }
    };

    const handleViewResults = () => {
        if (!workout || !onViewHistory) return;
        onViewHistory(workout);
    };

    const handleStartWorkout = () => {
        if (!workout) return;
        if (onWorkoutStarted) {
            onWorkoutStarted();
        } else if (onStart) {
            onStart(workout);
        }
        onClose();
    };

    const handleEditWorkout = () => {
        if (!workout || !onEdit) return;
        onEdit(workout);
        onClose();
    }

    if (isLoading || !workout) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Loading Workout...</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const isCompletedWorkout = workout?.pillar === 'activity' && workout?.type === 'workout';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>What would you like to do?</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3">
                    {isCompletedWorkout && (
                        <Button variant="default" size="lg" className="w-full" onClick={handleViewResults}>
                            View Results
                        </Button>
                    )}
                    {!isCompletedWorkout && (
                        <Button variant="default" size="lg" className="w-full" onClick={handleStartWorkout}>
                            Start Workout
                        </Button>
                    )}
                    {!isCompletedWorkout && (
                        <Button variant="secondary" size="lg" className="w-full" onClick={handleEditWorkout}>
                            Edit Time/Day
                        </Button>
                    )}
                    <Button variant="destructive" size="lg" className="w-full" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete Workout
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
