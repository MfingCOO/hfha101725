'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getLiveEvents, signUpForEvent } from '@/app/coach/events/actions';
import { Loader2, Zap, ImageIcon } from 'lucide-react';
import type { LiveEvent, UserProfile, ClientProfile } from '@/types';

interface AllEventsDialogProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  clientProfile: ClientProfile | null;
  onOpenUpgradeModal: () => void;
}

export function AllEventsDialog({ open, onClose, userProfile, clientProfile, onOpenUpgradeModal }: AllEventsDialogProps) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const fetchEvents = async () => {
        setIsLoading(true);
        try {
          const result = await getLiveEvents();
          if (result.success) {
            setEvents(result.data || []);
          } else {
            throw new Error(result.error || 'Failed to fetch events.');
          }
        } catch (error: any) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
        setIsLoading(false);
      };
      fetchEvents();
    }
  }, [open, toast]);

  const handleSignUp = async (eventId: string) => {
    if (!clientProfile?.uid) {
      toast({ title: 'Error', description: 'Could not identify user.', variant: 'destructive' });
      return;
    }
    setIsSigningUp(eventId);
    try {
      const input = { eventId, userId: clientProfile.uid };
      const result = await signUpForEvent(input);

      if (result.success) {
        toast({ title: 'Success!', description: "You've been registered for the event." });
        setEvents(prevEvents => prevEvents.map(e => 
            e.id === eventId ? { ...e, attendees: [...e.attendees, clientProfile.uid] } : e
        ));
      } else {
        throw new Error(result.error || 'Could not sign you up for the event.');
      }
    } catch (error: any) {
      toast({ title: 'Sign-up Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSigningUp(null);
    }
  };

  const userTier = clientProfile?.tier;
  const canJoin = userTier === 'premium' || userTier === 'coaching';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upcoming Live Events</DialogTitle>
          <DialogDescription>Browse and join upcoming live events to accelerate your progress.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No upcoming events scheduled. Check back soon!</p>
          ) : (
            events.map(event => {
              const isRegistered = clientProfile && event.attendees.includes(clientProfile.uid);
              const imageUrl = (event as any).imageUrl;

              return (
                <div key={event.id} className="p-4 border rounded-lg flex flex-col gap-3">
                  <div className="flex items-start gap-4">
                    <div className="relative w-20 h-20 shrink-0 border rounded-md overflow-hidden bg-muted">
                        {imageUrl ? (
                            <Image src={imageUrl} alt={event.title} fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-md leading-tight">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.eventTimestamp).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm w-full">{event.description}</p>
                  
                  <div className="w-full">
                    {canJoin ? (
                      <Button 
                          onClick={() => handleSignUp(event.id)}
                          disabled={isRegistered || isSigningUp === event.id}
                          className="w-full"
                      >
                        {isSigningUp === event.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRegistered ? 'Registered' : 'Sign Up'}
                      </Button>
                    ) : (
                      <Button onClick={() => { onClose(); onOpenUpgradeModal(); }} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:opacity-90">
                          <Zap className="mr-2 h-4 w-4" />
                          Upgrade to Join
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}