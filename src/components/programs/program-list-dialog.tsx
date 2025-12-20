'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Lock } from "lucide-react";
import { Program } from "@/types/workout-program";
import { UserProfile, UserTier } from "@/types";
import { getClientProgramsAction, setClientProgramAction } from '@/app/client/actions';
import { useToast } from "@/hooks/use-toast";

interface ProgramListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onOpenUpgradeModal: () => void;
}

export function ProgramListDialog({ isOpen, onClose, userProfile, onOpenUpgradeModal }: ProgramListDialogProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const { toast } = useToast();

  const hasProgramAccess = userProfile?.tier === UserTier.Premium || userProfile?.tier === UserTier.Coaching;

  useEffect(() => {
    const fetchPrograms = async () => {
      setIsLoading(true);
      const result = await getClientProgramsAction();

      if (!result.success) {
        toast({ variant: "destructive", title: "Error", description: (result as { error: string }).error });
        setIsLoading(false);
        return;
      }

      setPrograms(result.data);
      setIsLoading(false);
    };

    if (isOpen) {
      fetchPrograms();
    }
  }, [isOpen, toast]);

  const handleSubscribe = async (programId: string) => {
    if (!userProfile) return;

    if (!hasProgramAccess) {
      onOpenUpgradeModal();
      return;
    }

    setIsSubscribing(programId);
    const result = await setClientProgramAction(userProfile.uid, programId);
    
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: (result as { error: string }).error });
      setIsSubscribing(null);
      return;
    }

    toast({ title: "Success", description: "You have subscribed to the program." });
    onClose();
    setIsSubscribing(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Workout Programs</DialogTitle>
          <DialogDescription>Browse and subscribe to a program to start your journey.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : programs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No workout programs available at the moment. Please check back later.</p>
          ) : (
            programs.map(program => {
              const isSubscribed = userProfile?.activeProgramId === program.id;
              return (
                <Card key={program.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-1">
                        <h3 className="font-semibold text-lg">{program.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>
                        <Badge variant="outline" className="text-xs">{typeof program.duration === 'number' ? `${program.duration} Weeks` : 'Continuous'}</Badge>
                      </div>
                      {hasProgramAccess ? (
                        <Button 
                          size="sm"
                          onClick={() => handleSubscribe(program.id)}
                          disabled={isSubscribing === program.id || isSubscribed}
                        >
                          {isSubscribing === program.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {isSubscribed ? <CheckCircle className="mr-2 h-4 w-4" /> : null}
                          {isSubscribed ? 'Subscribed' : 'Subscribe'}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={onOpenUpgradeModal}>
                          <Lock className="mr-2 h-4 w-4" />
                          Upgrade to Subscribe
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
