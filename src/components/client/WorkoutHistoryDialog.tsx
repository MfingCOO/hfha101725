'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PerformanceLog, Workout, Exercise } from "@/types/workout-program";
import { getWorkoutHistoryAction, getPerformanceLogByIdAction, getWorkoutByIdAction } from '@/app/workouts/actions';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { LogDetailView } from '@/components/client/LogDetailView';
import { UserProfile } from '@/types';

interface WorkoutHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
  userId: string;
  workoutName: string;
  logId?: string; // If provided, opens directly to this log
  userProfile: UserProfile | null;
}

export function WorkoutHistoryDialog({ isOpen, onClose, workoutId, userId, workoutName, logId, userProfile }: WorkoutHistoryDialogProps) {
  const [history, setHistory] = useState<PerformanceLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<PerformanceLog | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;
      setIsLoading(true);

      // Fetch the full workout structure and exercise details first
      const workoutResult = await getWorkoutByIdAction(workoutId);
      if (workoutResult.success) {
        setWorkout(workoutResult.data.workout);
        setExercises(new Map(workoutResult.data.exercises.map(ex => [ex.id, ex])));
      } else {
        // Handle error
      }

      // If a specific logId is provided, fetch only that log
      if (logId) {
        const logResult = await getPerformanceLogByIdAction(logId);
        if (logResult.success && logResult.data) {
          setSelectedLog(logResult.data);
        }
      } else {
        // Otherwise, fetch the entire history for the workout
        const historyResult = await getWorkoutHistoryAction(userId, workoutId);
        if (historyResult.success) {
          setHistory(historyResult.data);
        }
      }
      setIsLoading(false);
    };

    fetchData();
  }, [isOpen, userId, workoutId, logId]);

  // When the dialog closes, reset the state
  const handleClose = () => {
    setSelectedLog(null);
    setHistory([]);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
            {selectedLog && !logId && (
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)} className="absolute left-2 top-2">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            )}
          <DialogTitle className={selectedLog ? 'text-center' : ''}>History for: {workoutName}</DialogTitle>
          {!selectedLog && <DialogDescription>Review your past performance for this workout.</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedLog && workout && userProfile ? (
              <LogDetailView log={selectedLog} workout={workout} exercises={exercises} unitSystem={userProfile.unitSystem || 'metric'} />
          ) : history.length > 0 ? (
            <div className="space-y-3 p-2">
              {history.map((log) => (
                <button key={log.id} onClick={() => setSelectedLog(log)} className="w-full text-left p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                  <h4 className="font-semibold text-md">{format(new Date(log.completedAt), 'EEEE, MMMM d, yyyy')}</h4>
                  <p className="text-sm text-muted-foreground">Duration: {Math.round(log.duration / 60)} minutes</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground pt-10">No history found for this workout.</p>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4 border-t mt-auto">
          <Button onClick={handleClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
