'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteCalendarEvent } from '@/app/calendar/actions';
import { deleteData } from '@/services/firestore';
import { triggerSummaryRecalculation } from '@/app/calendar/actions';
import { useToast } from '@/hooks/use-toast';
import type { ClientProfile } from '@/types';
import { WorkoutHistoryDialog } from '@/components/client/WorkoutHistoryDialog';

interface WorkoutActionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    event: any;
    client: ClientProfile;
    onStart: () => void;
    onEdit: () => void;
    onEntryChange: () => void; // To trigger a refresh on the calendar
}

export function WorkoutActionDialog({ isOpen, onClose, event, client, onStart, onEdit, onEntryChange }: WorkoutActionDialogProps) {
    const { toast } = useToast();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const isCompletedWorkout = event?.pillar === 'activity' && event?.type === 'workout';

    const handleDelete = async () => {
        if (!event) return;

        let result: { success: boolean; error?: string };

        if (isCompletedWorkout) {
            // This is a COMPLETED workout (an 'activity' log)
            result = await deleteData('activity', event.id, client.uid);
            if (result.success) {
                const dateString = new Date(event.entryDate).toISOString().split('T')[0];
                const timezoneOffset = new Date().getTimezoneOffset();
                const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                await triggerSummaryRecalculation(client.uid, dateString, userTimezone, timezoneOffset);
            }
        } else {
            // This is a SCHEDULED workout (a 'clientCalendar' event)
            result = await deleteCalendarEvent(event.id);
        }

        if (result.success) {
            toast({ title: 'Workout Deleted', description: 'The workout has been removed.' });
            onEntryChange(); // Refresh the calendar view
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || 'Could not delete the workout.' });
        }
        onClose();
    };

    const handleViewResults = () => {
        setIsHistoryOpen(true);
    }

    return (
        <>
            <Dialog open={isOpen && !isHistoryOpen} onOpenChange={onClose}>
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
                            <Button variant="default" size="lg" className="w-full" onClick={() => { onStart(); onClose(); }}>
                                Start Workout
                            </Button>
                        )}
                        {!isCompletedWorkout && (
                            <Button variant="secondary" size="lg" className="w-full" onClick={() => { onEdit(); onClose(); }}>
                                Edit Time/Day
                            </Button>
                        )}
                        <Button variant="destructive" size="lg" className="w-full" onClick={handleDelete}>
                            Delete Workout
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isCompletedWorkout && event && (
                <WorkoutHistoryDialog
                    isOpen={isHistoryOpen}
                    onClose={() => { setIsHistoryOpen(false); onClose(); }}
                    workoutId={event.relatedId} // The original workout ID
                    userId={client.uid}
                    workoutName={event.title}
                    logId={event.id} // The specific performance log ID
                    userProfile={client} // The client object is compatible with UserProfile
                />
            )}
        </>
    );
}
