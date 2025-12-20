'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScheduledEvent } from '@/types/event';
import { Trash2, Edit, PlayCircle, Loader2 } from 'lucide-react';

interface WorkoutActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onStart: () => void;
  event: ScheduledEvent | null;
}

export function WorkoutActionDialog({
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onStart,
  event,
}: WorkoutActionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);

  if (!event) {
    return null;
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setDeleteAlertOpen(false);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{event.title}</DialogTitle>
            <DialogDescription>
              What would you like to do with this workout?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 grid grid-cols-1 gap-2">
              <Button onClick={() => { onClose(); onStart(); }} className="w-full justify-start h-12 text-md">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Start Workout
              </Button>
              <Button variant="outline" onClick={() => { onClose(); onEdit(); }} className="w-full justify-start">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Time/Day
              </Button>
              <Button variant="outline" onClick={() => setDeleteAlertOpen(true)} className="w-full justify-start">
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                  <span className="text-destructive">Delete Workout</span>
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scheduled workout. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
