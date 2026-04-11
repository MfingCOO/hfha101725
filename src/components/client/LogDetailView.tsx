'use client';

import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PerformanceLog, Workout, Exercise } from "@/types/workout-program";
import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { UserProfile } from '@/types';

interface LogDetailViewProps {
    selectedLog: PerformanceLog;
    workout: Workout | undefined;
    exercises: Map<string, Exercise>;
    userProfile: UserProfile | null;
    onBack: () => void;
    onClose: () => void;
}

export function LogDetailView({ selectedLog, workout, exercises, userProfile, onBack, onClose }: LogDetailViewProps) {
    // Helper function to find the original exerciseId from the workout structure
    const getExerciseIdForBlock = (blockId: string): string | null => {
        if (!workout) return null;
        for (const block of workout.blocks) {
            if (block.id === blockId && block.type === 'exercise') {
                return block.exerciseId;
            }
            if (block.type === 'group') {
                for (const groupBlock of block.blocks) {
                    if (groupBlock.id === blockId && groupBlock.type === 'exercise') {
                        return groupBlock.exerciseId;
                    }
                }
            }
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full">
            <DialogHeader>
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 self-start">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to History
                </Button>
                <DialogTitle>Details for: {workout?.name || 'Workout'}</DialogTitle>
                <DialogDescription>Completed on {format(new Date(selectedLog.completedAt), 'PPP p')}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3 mt-4">
                <div className="space-y-3 text-sm">
                     <p><span className="font-semibold">Total Duration:</span> {Math.round(selectedLog.duration / 60)} minutes</p>
                     
                     {selectedLog.notes && (
                         <div>
                            <h4 className="font-semibold text-md mt-4">Notes</h4>
                            <p className="text-sm text-muted-foreground p-2 rounded-md bg-muted/50 whitespace-pre-wrap">{selectedLog.notes}</p>
                         </div>
                     )}

                     <h4 className="font-semibold text-md mt-4">Performance</h4>
                     <div className="space-y-2 p-2 rounded-md bg-muted/50">
                        <div className="grid grid-cols-4 gap-2 font-semibold text-muted-foreground">
                            <span>Exercise</span>
                            <span>Set</span>
                            <span>Reps</span>
                            <span>Weight</span>
                        </div>
                        {selectedLog.performance.map((perf, index) => {
                           const exerciseId = getExerciseIdForBlock(perf.blockId);
                           const exerciseName = exerciseId ? exercises.get(exerciseId)?.name : 'Exercise not found';
                           const weightDisplay = userProfile?.unitSystem === 'imperial' 
                               ? (perf.weight * 2.20462).toFixed(1) + ' lbs'
                               : perf.weight.toFixed(1) + ' kg';

                           return (
                               <div key={index} className="grid grid-cols-4 gap-2 items-center border-t pt-2">
                                   <span className="truncate">{exerciseName}</span>
                                   <span>{perf.setIndex + 1}</span>
                                   <span>{perf.reps}</span>
                                   <span>{weightDisplay}</span>
                               </div>
                           )
                        })}
                     </div>
                </div>
            </ScrollArea>
             <DialogFooter className="pt-4 border-t mt-auto">
                <Button onClick={onClose}>Close</Button>
            </DialogFooter>
        </div>
    );
}
