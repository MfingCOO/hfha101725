'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PerformanceLog } from "@/types/workout-program";
import { getWorkoutHistoryAction } from '@/app/workouts/actions';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';

interface WorkoutHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
  userId: string;
  workoutName: string;
}

export function WorkoutHistoryDialog({ isOpen, onClose, workoutId, userId, workoutName }: WorkoutHistoryDialogProps) {
  const [history, setHistory] = useState<PerformanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchHistory = async () => {
        setIsLoading(true);
        const result = await getWorkoutHistoryAction(userId, workoutId);
        if (result.success) {
          setHistory(result.data);
        }
        setIsLoading(false);
      };
      fetchHistory();
    }
  }, [isOpen, userId, workoutId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>History for: {workoutName}</DialogTitle>
          <DialogDescription>Review your past performance for this workout.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto p-1 pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              {history.map((log) => (
                <div key={log.id} className="p-3 rounded-md bg-muted/50">
                  <h4 className="font-semibold text-lg">{format(new Date(log.completedAt), 'PPP p')}</h4>
                  <p className="text-sm text-muted-foreground">Duration: {Math.round(log.duration / 60)} minutes</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {log.performance.map((perf, index) => (
                       <div key={index} className="grid grid-cols-3 gap-2 items-center">
                           <span>Block: {perf.blockId.substring(0,5)}...</span>
                           <span>Reps: {perf.reps}</span>
                           <span>Weight: {perf.weight}</span>
                       </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No history found for this workout.</p>
          )}
        </ScrollArea>

        <DialogFooter className="pt-4 border-t mt-auto">
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
