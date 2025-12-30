'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PerformanceLog, Workout } from "@/types/workout-program";
import { getFullWorkoutHistoryAction, getWorkoutsByIdsAction } from '@/app/workouts/actions';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { UserProfile } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface FullWorkoutHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
}

export function FullWorkoutHistoryDialog({ isOpen, onClose, userProfile }: FullWorkoutHistoryDialogProps) {
  const [history, setHistory] = useState<PerformanceLog[]>([]);
  const [workouts, setWorkouts] = useState<Map<string, Workout>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PerformanceLog | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && userProfile) {
      const fetchHistory = async () => {
        setIsLoading(true);
        try {
          const historyResult = await getFullWorkoutHistoryAction(userProfile.uid);
          if (historyResult.success) {
            const logs = historyResult.data;
            setHistory(logs);
            
            if (logs.length > 0) {
              const workoutIds = [...new Set(logs.map(log => log.workoutId).filter(id => id))];
              const workoutsResult = await getWorkoutsByIdsAction(workoutIds);
              if (workoutsResult.success) {
                setWorkouts(new Map(workoutsResult.data.map(w => [w.id, w])));
              } else {
                throw new Error('Could not load workout details.');
              }
            }

          } else {
            throw new Error('Could not load workout history.');
          }
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
      };
      fetchHistory();
    } else {
        setHistory([]);
        setWorkouts(new Map());
        setSelectedLog(null);
    }
  }, [isOpen, userProfile, toast]);

  const handleClose = () => {
      setSelectedLog(null);
      onClose();
  }

  const renderLogDetailView = () => {
      if (!selectedLog) return null;
      const workout = workouts.get(selectedLog.workoutId);

      return (
        <div className="flex flex-col h-full">
            <DialogHeader>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)} className="mb-2 self-start">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to History
                </Button>
                <DialogTitle>Details for: {workout?.name || 'Workout'}</DialogTitle>
                <DialogDescription>Completed on {format(new Date(selectedLog.completedAt), 'PPP p')}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3 mt-4">
                <div className="space-y-3 text-sm">
                     <p><span className="font-semibold">Total Duration:</span> {Math.round(selectedLog.duration / 60)} minutes</p>
                     <h4 className="font-semibold text-md mt-4">Performance</h4>
                     <div className="space-y-2 p-2 rounded-md bg-muted/50">
                        <div className="grid grid-cols-4 gap-2 font-semibold text-muted-foreground">
                            <span>Exercise</span>
                            <span>Set</span>
                            <span>Reps</span>
                            <span>Weight</span>
                        </div>
                        {selectedLog.performance.map((perf, index) => (
                           <div key={index} className="grid grid-cols-4 gap-2 items-center border-t pt-2">
                               <span>{perf.blockId.substring(0,5)}...</span>
                               <span>{perf.setIndex + 1}</span>
                               <span>{perf.reps}</span>
                               <span>{perf.weight.toFixed(1)} {userProfile?.unitSystem === 'imperial' ? 'lbs' : 'kg'}</span>
                           </div>
                        ))}
                     </div>
                </div>
            </ScrollArea>
             <DialogFooter className="pt-4 border-t mt-auto">
                <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
        </div>
      )
  }

  const renderHistoryListView = () => (
    <div className="flex flex-col h-full">
        <DialogHeader>
          <DialogTitle>Full Workout History</DialogTitle>
          <DialogDescription>Review all your past completed workouts.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              {history.map((log) => {
                  const workout = workouts.get(log.workoutId);
                  return (
                    <div key={log.id} className="p-3 rounded-md bg-muted/50 flex justify-between items-center">
                        <div>
                            <h4 className="font-semibold text-md">{workout?.name || 'Workout'}</h4>
                            <p className="text-sm text-muted-foreground">{format(new Date(log.completedAt), 'PPP p')}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedLog(log)}>View Details</Button>
                    </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground pt-10">No history found.</p>
          )}
        </ScrollArea>
         <DialogFooter className="pt-4 border-t mt-auto">
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={!selectedLog ? handleClose : (open) => {if(!open) handleClose()}}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          {selectedLog ? renderLogDetailView() : renderHistoryListView()}
      </DialogContent>
    </Dialog>
  );
}
