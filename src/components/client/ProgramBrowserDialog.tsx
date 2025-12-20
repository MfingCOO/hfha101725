'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Program } from '@/types/workout-program';
import { UserProfile } from '@/types';
import { getClientProgramsAction, setClientProgramAction } from '@/app/client/actions';
import { useToast } from '@/hooks/use-toast';

interface ProgramBrowserDialogProps {
  isOpen: boolean;
  onClose: (shouldRefetch?: boolean) => void;
  userProfile: UserProfile | null;
}

export function ProgramBrowserDialog({ isOpen, onClose, userProfile }: ProgramBrowserDialogProps) {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [viewingProgram, setViewingProgram] = useState<Program | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      setIsLoading(true);
      try {
        const result = await getClientProgramsAction();
        if (result.success) {
          setPrograms(result.data);
        } else {
          throw new Error('Failed to fetch programs.');
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchPrograms();
    }
  }, [isOpen, toast]);

  const handleSelectProgram = async (programId: string) => {
    if (!userProfile) return;
    setIsSubmittingId(programId);
    try {
      const result = await setClientProgramAction(userProfile.uid, programId);
      if (result.success) {
        toast({ title: 'Success!', description: 'Your active program has been updated.' });
        onClose(true);
      } else {
        throw new Error('Failed to set program.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmittingId(null);
    }
  };

  const handleClose = () => {
    setViewingProgram(null);
    onClose(false);
  }

  const renderProgramListView = () => (
    <div className="flex-1 overflow-y-auto p-1 space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : programs.length > 0 ? (
        programs.map(program => {
            const isSelected = userProfile?.activeProgramId === program.id;
            return (
                <div key={program.id} className="p-4 border rounded-lg flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold">{program.name}</h3>
                        <p className="text-sm text-muted-foreground">{program.description || 'No description available.'}</p>
                    </div>
                    <Button 
                        onClick={() => setViewingProgram(program)} 
                        variant={isSelected ? 'secondary' : 'outline'}
                        size="sm"
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2"/>
                          Selected
                        </>
                      ) : 'View'}
                    </Button>
                </div>
            )
        })
      ) : (
        <div className="text-center text-muted-foreground p-12">
          <p>No programs available.</p>
        </div>
      )}
    </div>
  );

  const renderProgramDetailView = () => {
    if (!viewingProgram) return null;
    const isSubmitting = isSubmittingId === viewingProgram.id;
    const isAlreadySelected = userProfile?.activeProgramId === viewingProgram.id;

    return (
        <div className="flex-1 overflow-y-auto p-1 flex flex-col">
            <div className='mb-4'>
                <Button variant="ghost" size="sm" onClick={() => setViewingProgram(null)} className="mb-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to List
                </Button>
                <h3 className="font-bold text-2xl">{viewingProgram.name}</h3>
                <p className="text-muted-foreground mt-1">{viewingProgram.description}</p>
            </div>

            <div className="space-y-2 mt-4">
                <p className="font-semibold">Weeks in this program:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {viewingProgram.weeks?.map(week => <li key={week.id}>{week.name}</li>)}
                    {(!viewingProgram.weeks || viewingProgram.weeks.length === 0) && <li>No weeks defined.</li>}
                </ul>
            </div>

            <div className="mt-auto">
                 <Button 
                    onClick={() => handleSelectProgram(viewingProgram.id)} 
                    disabled={isSubmitting || isAlreadySelected}
                    className="w-full"
                    size="lg"
                >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                     isAlreadySelected ? 'You are on this program' : 'Set as My Active Program'}
                </Button>
            </div>
        </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{viewingProgram ? 'Program Details' : 'Browse Workout Programs'}</DialogTitle>
          <DialogDescription>
            {viewingProgram ? 'Review the details below and set this as your active program.' : 'Select a new program to set it as your active plan.'}
          </DialogDescription>
        </DialogHeader>

        {viewingProgram ? renderProgramDetailView() : renderProgramListView()}

        <DialogFooter className="pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
