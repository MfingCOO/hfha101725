'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCoachAvailabilityAndEvents, saveCalendarEvent } from '@/app/coach/calendar/actions';
import { getCoachesAction } from '@/app/client/actions';
import type { AvailabilitySettings, ClientProfile } from '@/types';
import { addMinutes, format, startOfDay, getDay, areIntervalsOverlapping, isPast, addDays, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, endOfDay } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { formatInUserTimezone, convertToUTC, getUserTimezone } from '@/services/time';

interface BookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const parseDateString = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export function BookingDialog({ isOpen, onClose }: BookingDialogProps) {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [coaches, setCoaches] = useState<ClientProfile[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(addDays(new Date(), 2)));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 2));
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySettings | null>(null);
  const [existingEvents, setExistingEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [userTimezone, setUserTimezone] = useState('');

  useEffect(() => {
    async function fetchCoaches() {
      const result = await getCoachesAction();
      if (result.success && result.data) {
        const filteredCoaches = result.data.filter(coach => 
          coach.fullName?.includes('Crystal') || coach.fullName?.includes('Alan')
        );
        setCoaches(filteredCoaches);
        if (filteredCoaches.length > 0) {
          setSelectedCoachId(filteredCoaches[0].uid);
        }
      }
    }
    if (isOpen) {
      fetchCoaches();
      setUserTimezone(getUserTimezone());
    }
  }, [isOpen]);

  // UNIFIED AVAILABILITY FIX: This hook now fetches all events for a day
  // and does not re-run when the coach is switched.
  useEffect(() => {
    if (isOpen && selectedDate) {
      setIsLoading(true);
      setSelectedSlot(null);
      
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);

      getCoachAvailabilityAndEvents(start, end).then(result => {
        if (result.success && result.data) {
          setAvailability(result.data.availability);
          // Use all events for the day to block off slots, regardless of coach.
          setExistingEvents(result.data.events || []);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch coach availability.' });
          setAvailability(null);
          setExistingEvents([]);
        }
        setIsLoading(false);
      });
    }
  }, [isOpen, selectedDate, toast]);
  
  const handleWeekChange = (direction: 'next' | 'prev') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'next' ? 7 : -7));
  };

  const availableSlots = useMemo(() => {
    if (!availability || !selectedDate || !availability.timezone) return [];

    const isBlockedForVacation = availability.vacationBlocks?.some(block => 
      areIntervalsOverlapping(
        { start: startOfDay(selectedDate), end: endOfDay(selectedDate) },
        { start: parseDateString(block.start as string), end: endOfDay(parseDateString(block.end as string)) }
      )
    );

    if (isBlockedForVacation) return [];

    const dayOfWeek = getDay(selectedDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todaySettings = availability.weekly.find(d => d.day === dayNames[dayOfWeek]);
    
    if (!todaySettings || !todaySettings.enabled) return [];
    
    const slots: Date[] = [];
    const coachTimezone = availability.timezone;

    for (const slot of todaySettings.slots) {
      const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
      const startString = `${selectedDateString}T${slot.start}:00`;
      const endString = `${selectedDateString}T${slot.end}:00`;
      
      let currentSlotTime = convertToUTC(startString, coachTimezone);
      const endTime = convertToUTC(endString, coachTimezone);

      while (currentSlotTime < endTime) {
        const slotEnd = addMinutes(currentSlotTime, 15);

        const isOverlapping = existingEvents.some(event => 
          areIntervalsOverlapping(
            { start: currentSlotTime, end: slotEnd },
            { start: new Date(event.start), end: new Date(event.end) },
            { inclusive: false }
          )
        );

        if (!isOverlapping && !isPast(currentSlotTime)) {
          slots.push(new Date(currentSlotTime));
        }

        currentSlotTime = addMinutes(currentSlotTime, 15);
      }
    }
    return slots;
  }, [availability, selectedDate, existingEvents]);

  const handleBooking = async () => {
    if (!selectedSlot || !user || !userProfile || !selectedCoachId) return;

    setIsBooking(true);
    try {
        const selectedCoach = coaches.find(c => c.uid === selectedCoachId);
        const eventData = {
            title: `Coaching: ${userProfile.fullName}`,
            start: selectedSlot,
            end: addMinutes(selectedSlot, 15),
            clientId: user.uid,
            clientName: userProfile.fullName,
            coachId: selectedCoach?.uid,
            coachName: selectedCoach?.fullName,
            isPersonal: false,
            attachVideoLink: true,
            isCoachBooking: false, // BUG FIX: Added missing property
        };
        const result = await saveCalendarEvent(eventData);
        if(result.success) {
            toast({ title: "Appointment Booked!", description: `Your call is confirmed for ${formatInUserTimezone(selectedSlot, "PPP p")}.` });
            onClose();
        } else {
            throw new Error(result.error || "Failed to book appointment.");
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Booking Failed', description: error.message });
    } finally {
        setIsBooking(false);
    }
  }

    const availableDays = useMemo(() => {
        return eachDayOfInterval({
          start: addDays(new Date(), 2),
          end: addDays(new Date(), 30),
        });
    }, []);

    const weekDays = useMemo(() => {
        return eachDayOfInterval({
          start: currentWeekStart,
          end: endOfWeek(currentWeekStart),
        });
    }, [currentWeekStart]);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md p-0 h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Book a Coaching Call</DialogTitle>
          <DialogDescription>Select a coach, date, and time for your 15-minute check-in.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
            {coaches.length > 0 && (
                 <div className="space-y-2">
                    <Label>Select Coach</Label>
                    <div className="flex gap-2">
                        {coaches.map(coach => (
                            <Button 
                                key={coach.uid} 
                                variant={selectedCoachId === coach.uid ? 'default' : 'outline'}
                                onClick={() => setSelectedCoachId(coach.uid)}
                                className="flex-1"
                            >
                                <User className="mr-2 h-4 w-4"/> {coach.fullName ? coach.fullName.split(' ')[0] : 'Coach'}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="space-y-2">
                 <Label>Select Date</Label>
                 <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleWeekChange('prev')} disabled={isSameDay(currentWeekStart, startOfWeek(addDays(new Date(), 2)))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 grid grid-cols-7 gap-1">
                        {weekDays.map((day) => {
                            const isSelectable = availableDays.some(d => isSameDay(d, day));
                            return (
                            <Button
                                key={day.toISOString()}
                                variant="date"
                                size="sm"
                                disabled={!isSelectable}
                                data-selected={selectedDate ? isSameDay(day, selectedDate) : false}
                                onClick={() => setSelectedDate(day)}
                                className="h-12 text-xs"
                            >
                                <span className="text-xs uppercase">{format(day, 'EEE')}</span>
                                <span className="text-base font-bold">{format(day, 'd')}</span>
                            </Button>
                        )})}
                    </div>
                     <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => handleWeekChange('next')} disabled={isSameDay(currentWeekStart, startOfWeek(addDays(new Date(), 30)))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 space-y-2 flex flex-col min-h-0">
                <Label>
                    Available Times for {selectedDate ? format(selectedDate, 'PPP') : '...'}
                    {userTimezone && <span className="text-muted-foreground text-xs ml-2"> (times shown in {userTimezone})</span>}
                </Label>
                <div className="flex-1 rounded-lg border min-h-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : availableSlots.length > 0 ? (
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2">
                        {availableSlots.map(slot => (
                            <Button 
                                key={slot.toISOString()}
                                variant={selectedSlot?.getTime() === slot.getTime() ? 'default' : 'outline'}
                                onClick={() => setSelectedSlot(slot)}
                                size="sm"
                            >
                                {formatInUserTimezone(slot, 'p')}
                            </Button>
                        ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex items-center justify-center h-full text-center p-4">
                         <p className="text-sm text-muted-foreground">No available slots for this day. Please try another date.</p>
                    </div>
                )}
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleBooking} disabled={!selectedSlot || isBooking}>
            {isBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
            Confirm Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
