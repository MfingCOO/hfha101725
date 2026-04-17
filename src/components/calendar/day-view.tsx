'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Loader2, ThumbsUp, MessageSquare } from 'lucide-react';
import { format, addMinutes, addHours, differenceInMinutes, addDays } from 'date-fns';
import { pillarDetails } from '@/lib/pillars';
import type { ClientProfile, LogEntry } from '@/types';
import { cn } from '@/lib/utils';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { deleteData } from '@/services/firestore';
import { useToast } from '@/hooks/use-toast';
import { pillarsAndTools } from '@/lib/pillars';
import { AppointmentDetailDialog } from './AppointmentDetailDialog';
import { LiveEventDetailDialog } from './LiveEventDetailDialog';
import { triggerSummaryRecalculation, addCoachFeedbackToAction } from '@/app/calendar/actions';
import { WorkoutActionDialog } from './WorkoutActionDialog';
import { EditWorkoutDialog } from './EditWorkoutDialog';
import { getWorkoutByIdAction } from '@/app/workouts/actions';
import { ActiveWorkoutDialog } from '../client/ActiveWorkoutDialog';
import { FullWorkoutHistoryDialog } from '../client/FullWorkoutHistoryDialog';
import type { Workout, Exercise } from '@/types/workout-program';
import { useAuth } from '../auth/auth-provider';
import { Textarea } from '../ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const pillarColors: Record<string, string> = {
    nutrition: 'bg-amber-500 border-amber-700',
    activity: 'bg-orange-500 border-orange-700',
    sleep: 'bg-indigo-500 border-indigo-700',
    'sleep-nap': 'bg-indigo-500/70 border-indigo-600',
    hydration: 'bg-blue-500 border-blue-700',
    stress: 'bg-red-600 border-red-800',
    relief: 'bg-green-500 border-green-700',
    measurements: 'bg-gray-500 border-gray-700',
    protocol: 'bg-teal-500 border-teal-700',
    planner: 'bg-lime-500 border-lime-700',
    craving: 'bg-orange-600 border-orange-800',
    binge: 'bg-red-600 border-red-800',
    habit: 'bg-yellow-500 border-yellow-700',
    appointment: 'bg-purple-500 border-purple-700',
    'live-event': 'bg-rose-500 border-rose-700',
    workout: 'bg-green-600 border-green-800',
    'scheduled-workout': 'bg-slate-500 border-slate-700',
    default: 'bg-gray-500 border-gray-700',
};

interface PositionedEntry {
    id: string;
    top: number;
    height: number;
    left: number;
    width: number;
    originalData: LogEntry;
}

const safeParseDate = (dateSource: any): Date | null => {
    if (!dateSource) return null;
    if (typeof dateSource.toDate === 'function') return dateSource.toDate();
    if (dateSource instanceof Date) return dateSource;
    const parsed = new Date(dateSource);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const processEntriesForLayout = (entries: LogEntry[], selectedDate: Date): PositionedEntry[] => {
    if (!entries || entries.length === 0) return [];
    
    const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    const totalMinutesInDay = 24 * 60;

    const timedEntries = entries.map(entry => {
        let start: Date | null = null;
        let end: Date | null = null;

        const eventStart = safeParseDate(entry.start || entry.startTime);
        const eventEnd = safeParseDate(entry.end || entry.endTime);
        const entryDate = safeParseDate(entry.entryDate);
        const indulgenceDate = safeParseDate(entry.indulgenceDate);

        if (entry.type === 'workout' && eventStart) {
            start = eventStart;
            const duration = entry.duration || 60; 
            end = addMinutes(start, duration);
        } else if (entry.pillar === 'sleep' && entryDate) {
            start = entryDate;
            end = addHours(start, entry.duration || 0);
        } else if (entry.pillar === 'activity' && entryDate) {
            start = entryDate;
            end = addMinutes(start, entry.duration || 15);
        } else if ((entry.pillar === 'appointment' || entry.type === 'live-event') && eventStart && eventEnd) {
            start = eventStart;
            end = eventEnd;
        } else if (entry.pillar === 'planner' && indulgenceDate) {
            start = indulgenceDate;
            end = addMinutes(start, 15);
        } else if (entryDate) {
            start = entryDate;
            end = addMinutes(start, 30);
        }

        if (!start || !end) return null;
        
        return {
            id: entry.id,
            startMinutes: Math.max(0, differenceInMinutes(start, dayStart)),
            endMinutes: Math.min(totalMinutesInDay, differenceInMinutes(end, dayStart)),
            originalData: entry,
        };
    })
    .filter((e): e is { id: string; startMinutes: number; endMinutes: number; originalData: LogEntry; } => e !== null && e.endMinutes > e.startMinutes)
    .sort((a, b) => a!.startMinutes - b!.startMinutes || b!.endMinutes - a!.endMinutes);

    const positionedEntries: PositionedEntry[] = [];
    const eventClusters: any[][] = [];

    for (const entry of timedEntries) {
        let placed = false;
        for (const cluster of eventClusters) {
            if (cluster.some(e => entry!.startMinutes < e.endMinutes && entry!.endMinutes > e.startMinutes)) {
                cluster.push(entry);
                placed = true;
                break;
            }
        }
        if (!placed) {
            eventClusters.push([entry]);
        }
    }

    for (const cluster of eventClusters) {
        cluster.sort((a, b) => a.startMinutes - b.startMinutes);
        
        const cols: any[][] = [];
        for (const entry of cluster) {
            let placedInCol = false;
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].every(e => entry.startMinutes >= e.endMinutes)) {
                    cols[i].push(entry);
                    placedInCol = true;
                    break;
                }
            }
            if (!placedInCol) {
                cols.push([entry]);
            }
        }
        
        const clusterWidth = 100 / cols.length;
        for (let i = 0; i < cols.length; i++) {
            for (const entry of cols[i]) {
                const durationMinutes = Math.max(1, entry.endMinutes - entry.startMinutes);
                const height = (durationMinutes / totalMinutesInDay) * 100;
                positionedEntries.push({
                    id: entry.id,
                    top: (entry.startMinutes / totalMinutesInDay) * 100,
                    height: Math.max(height, 2.0833),
                    left: i * clusterWidth,
                    width: clusterWidth,
                    originalData: entry.originalData,
                });
            }
        }
    }

    return positionedEntries;
};

const getInitials = (name: string) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('');
};

const TimelineEntry = ({ entry, onSelect, isHighlighted, client, onEntryChange }: { entry: PositionedEntry, onSelect: (entry: any) => void, isHighlighted: boolean, client: ClientProfile, onEntryChange: () => void }) => {
    const { user, isCoach } = useAuth();
    const { toast } = useToast();
    const [noteText, setNoteText] = useState(entry.originalData.coachNote?.text || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNotePopoverOpen, setIsNotePopoverOpen] = useState(false);
    
    // Create local state for feedback to provide immediate UI updates
    const [localLike, setLocalLike] = useState(!!entry.originalData.coachLike);
    const [localNote, setLocalNote] = useState(entry.originalData.coachNote);

    const original = entry.originalData;
    let pillarKey;
    if (original.type === 'workout') {
      pillarKey = original.isCompleted === false ? 'scheduled-workout' : 'workout';
    } else {
      pillarKey = original.pillar || 'default';
    }

    let displayName = original.title || original.name;
    if (original.type === 'relief' && original.pillar === 'stress') { pillarKey = 'relief'; displayName = 'Stress Relief'; } 
    else if (original.type === 'craving') { pillarKey = 'craving'; displayName = 'Craving Log'; } 
    else if (original.type === 'binge') { pillarKey = 'binge'; displayName = 'Binge Log'; } 
    else if (original.pillar === 'stress') { displayName = 'Stress Log'; }

    const details = pillarDetails[pillarKey] || pillarDetails.default;
    const Icon = details.icon;
    const colorClass = pillarColors[pillarKey] || pillarColors.default;

    if (!displayName) {
        displayName = details.getTitle(original);
    }
    
    const hasUserNote = original.notes && original.notes.trim() !== '';

    const handleFeedback = async (type: 'like' | 'note') => {
        if (!user || !isCoach) return;
        setIsSubmitting(true);
        
        // Optimistic UI update
        if (type === 'like') {
            setLocalLike(!localLike);
        }
        if (type === 'note') {
            const newNote = { 
                text: noteText, 
                coachName: user.displayName || 'Coach', 
                coachId: user.uid, 
                timestamp: new Date().toISOString() 
            };
            setLocalNote(newNote);
        }

        try {
            const result = await addCoachFeedbackToAction({
                entryId: original.id,
                clientId: client.uid,
                coachId: user.uid,
                feedbackType: type,
                noteText: type === 'note' ? noteText : undefined,
                pillar: original.pillar,
            });
            if (result.success) {
                toast({ title: 'Feedback Sent!' });
                setIsNotePopoverOpen(false);
                // No full re-fetch, just let the optimistic update stand
            } else {
                // Revert on failure
                if (type === 'like') setLocalLike(!!original.coachLike); 
                if (type === 'note') setLocalNote(original.coachNote);
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
             // Revert on failure
             if (type === 'like') setLocalLike(!!original.coachLike);
             if (type === 'note') setLocalNote(original.coachNote);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            id={`timeline-entry-${entry.id}`}
            style={{ top: `${entry.top}%`, height: `${entry.height}%`, left: `${entry.left}%`, width: `${entry.width}%`, padding: '1px' }} 
            className="absolute"
        >
             <div className={cn("relative flex flex-col gap-1 p-1 text-white h-full bg-black/20 rounded-md overflow-hidden", colorClass, isHighlighted && 'ring-2 ring-offset-2 ring-offset-background ring-white')}>
                <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 cursor-pointer flex-1 min-w-0" onClick={() => onSelect(entry.originalData)}>
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-[10px] font-medium truncate">{displayName}</span>
                    </div>
                     <div className="flex items-center gap-1 flex-shrink-0">
                        {isCoach && (
                            <>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleFeedback('like')} disabled={isSubmitting}>
                                    <ThumbsUp className={cn("h-3 w-3", localLike && "text-black")} />
                                </Button>
                                <Popover open={isNotePopoverOpen} onOpenChange={setIsNotePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-5 w-5">
                                            <MessageSquare className={cn("h-3 w-3", !!localNote && "text-black")} />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2">
                                        <div className="space-y-2">
                                            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="text-xs h-20" />
                                            <Button size="xs" className="w-full" onClick={() => handleFeedback('note')} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Note'}
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                        {!isCoach && (
                            <>
                                {localLike && <ThumbsUp className="h-3 w-3 text-black" />}
                                {localNote && (
                                     <Popover>
                                        <PopoverTrigger>
                                            <MessageSquare className="h-3 w-3 text-black" />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-2 text-xs">
                                            <p className="font-bold">{localNote.coachName} says:</p>
                                            <p className="italic">{localNote.text}</p>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </>
                        )}
                     </div>
                </div>

                {hasUserNote && !isCoach && (
                    <div className="text-[10px] bg-black/10 p-1 rounded-sm italic truncate">
                        &quot;{original.notes}&quot;
                    </div>
                )}
            </div>
        </div>
    );
};


interface DayViewProps {
    client: ClientProfile;
    selectedDate: Date;
    entries: any[];
    isLoading: boolean;
    onDateChange: (date: Date) => void;
    onEntryChange: () => void;
    highlightedEntryId?: string;
}

export function DayView({ client, selectedDate, entries, isLoading, onDateChange, onEntryChange, highlightedEntryId }: DayViewProps) {
    const { toast } = useToast();
    const { isCoach } = useAuth(); // CORRECTED: Moved hook to top level
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [activePillar, setActivePillar] = useState<any | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [selectedLiveEvent, setSelectedLiveEvent] = useState<any | null>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isInitialScrollDone, setIsInitialScrollDone] = useState(false);
    const [userTimezone, setUserTimezone] = useState<string>('');
    const [eventToAction, setEventToAction] = useState<any | null>(null);
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isPreparingWorkout, setIsPreparingWorkout] = useState(false);
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
    const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<Exercise[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    useEffect(() => {
        setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);

    const processedEntries = useMemo(() => {
        return processEntriesForLayout(entries, selectedDate);
    }, [entries, selectedDate]);

    useEffect(() => {
        if (isLoading || isInitialScrollDone || !viewportRef.current) return;

        const HOURLY_HEIGHT = 60;
        let scrollTop: number | undefined;

        if (highlightedEntryId) {
            const highlightedEntry = processedEntries.find(e => e.id === highlightedEntryId);
            if (highlightedEntry) {
                const viewportHeight = viewportRef.current.clientHeight;
                const entryTop = (highlightedEntry.top / 100) * (24 * HOURLY_HEIGHT);
                scrollTop = entryTop - (viewportHeight / 2) + ((highlightedEntry.height / 100) * (24 * HOURLY_HEIGHT) / 2);
            }
        } else {
            let targetTime: string | undefined;
            const sleepEntry = entries.find(e => e.pillar === 'sleep' && !e.isNap);
            if (sleepEntry && sleepEntry.wakeUpTime) {
                targetTime = sleepEntry.wakeUpTime;
            } else if (client.onboarding?.wakeTime) {
                targetTime = client.onboarding.wakeTime;
            }
            if (targetTime) {
                const [hours, minutes] = targetTime.split(':').map(Number);
                const targetTotalMinutes = hours * 60 + minutes - 30;
                scrollTop = (targetTotalMinutes / 60) * HOURLY_HEIGHT;
            }
        }
        
        if (scrollTop !== undefined) {
             setTimeout(() => {
                if (viewportRef.current) {
                    viewportRef.current.scrollTo({
                        top: Math.max(0, scrollTop),
                        behavior: 'smooth',
                    });
                    setIsInitialScrollDone(true);
                }
            }, 150);
        }

    }, [isLoading, client, highlightedEntryId, processedEntries, isInitialScrollDone, entries]);
    
    const handleSelectEntry = (entryData: any) => {
        if (isCoach) {
            const pillarConfig = pillarsAndTools.find(p => p.id === entryData.pillar);
            if (pillarConfig) {
                setActivePillar(pillarConfig);
                setSelectedEntry(entryData);
                return;
            }
        }
        
        const isWorkout = (entryData.pillar === 'activity' && entryData.type === 'workout') || (entryData.type === 'workout');
        if (isWorkout) {
            setEventToAction(entryData);
            setIsActionDialogOpen(true);
            return;
        }
        if (entryData.pillar === 'appointment') {
            setSelectedAppointment(entryData);
            return;
        }
        if (entryData.type === 'live-event') {
            setSelectedLiveEvent(entryData);
            return;
        }

        const pillarId = entryData.pillar;
        const pillarConfig = pillarsAndTools.find(p => p.id === pillarId);
        if (pillarConfig) {
            setActivePillar(pillarConfig);
            setSelectedEntry(entryData);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not identify the type of this entry.',
            });
        }
    };
        
    const handleDialogClose = (wasSaved: boolean) => {
        setSelectedEntry(null);
        setActivePillar(null);
        if (wasSaved) {
            onEntryChange(); 
        }
    };
    
    const handleAppointmentDialogClose = (wasDeleted: boolean) => {
        setSelectedAppointment(null);
        if (wasDeleted) {
            onEntryChange();
        }
    };

    const handleDelete = async () => {
        if (!selectedEntry) return;
        const { pillar, id } = selectedEntry;
        const result = await deleteData(pillar, id, client.uid);

        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            return;
        }

        toast({ title: 'Entry Deleted' });
        const dateString = selectedDate.toISOString().split('T')[0];
        const timezoneOffset = selectedDate.getTimezoneOffset();
        await triggerSummaryRecalculation(client.uid, dateString, userTimezone, timezoneOffset);
        handleDialogClose(true);
    };

    const handleStartWorkout = async (event: any) => {
        if (!event || !event.relatedId) return;
        setIsActionDialogOpen(false);
        setIsPreparingWorkout(true);
        try {
            const workoutResult = await getWorkoutByIdAction(event.relatedId);
            if (workoutResult.success === false) { 
                throw new Error(workoutResult.error);
            }
            setActiveWorkout(workoutResult.data.workout);
            setActiveWorkoutExercises(workoutResult.data.exercises);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Starting Workout',
                description: error.message || 'An unknown error occurred.',
            });
            setActiveWorkout(null);
        } finally {
            setIsPreparingWorkout(false);
        }
    };    
    
    const changeDay = (days: number) => {
        setIsInitialScrollDone(false);
        onDateChange(addDays(selectedDate, days));
    };
    
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 p-2 flex justify-between items-center border-b">
                <Button variant="ghost" size="icon" onClick={() => changeDay(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-lg font-semibold">{format(selectedDate, 'PPP')}</h3>
                <Button variant="ghost" size="icon" onClick={() => changeDay(1)}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="flex-1 min-h-0 relative flex">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}
                {isPreparingWorkout && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-30">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className='mt-4 text-sm text-muted-foreground'>Preparing your workout...</p>
                    </div>
                )}
                    <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
                    <div className="flex">
                        <div className="w-12 flex-shrink-0 pr-1 border-r">
                            {hours.map(hour => (
                                <div key={hour} className="h-[60px] text-right relative -top-2.5">
                                    <span className="text-[10px] text-muted-foreground pr-1">{format(new Date(0, 0, 0, hour), 'ha')}</span>
                                </div>
                            ))}
                        </div>
                        <div className="relative flex-1">
                                {hours.map(hour => (
                                <div key={hour} className="h-[60px] border-b" />
                            ))}
                           
                           {processedEntries.map(entry => (
                               <TimelineEntry 
                                 key={entry.id} 
                                 entry={entry} 
                                 onSelect={handleSelectEntry} 
                                 isHighlighted={entry.id === highlightedEntryId}
                                 client={client}
                                 onEntryChange={onEntryChange}
                                />
                           ))}
                        </div>
                    </div>
                </ScrollArea>
            </div>
            
            {selectedEntry && activePillar && (
                <DataEntryDialog
                    open={!!selectedEntry}
                    onOpenChange={handleDialogClose}
                    pillar={activePillar}
                    initialData={selectedEntry}
                    onDelete={handleDelete}
                    userId={client.uid}
                />
            )}
            
            <AppointmentDetailDialog 
                isOpen={!!selectedAppointment}
                onClose={handleAppointmentDialogClose}
                event={selectedAppointment}
            />

            <LiveEventDetailDialog
                isOpen={!!selectedLiveEvent}
                onClose={() => setSelectedLiveEvent(null)}
                event={selectedLiveEvent}
            />
            
            <WorkoutActionDialog
                isOpen={isActionDialogOpen}
                onClose={() => setIsActionDialogOpen(false)}
                event={eventToAction}
                client={client}
                onStart={() => handleStartWorkout(eventToAction)}
                onEdit={() => {
                    setIsEditDialogOpen(true);
                    setIsActionDialogOpen(false);
                }}
                onViewHistory={() => {
                    setIsHistoryOpen(true);
                    setIsActionDialogOpen(false);
                }}
                onEntryChange={onEntryChange}
            />

            {eventToAction && isEditDialogOpen && (
                <EditWorkoutDialog
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setIsEditDialogOpen(false);
                            setEventToAction(null);
                            onEntryChange();
                        }
                    }}
                    event={eventToAction}
                />
            )}
            
            {activeWorkout && (
                <ActiveWorkoutDialog
                    isOpen={!!activeWorkout}
                    onClose={() => {
                        setActiveWorkout(null);
                        setEventToAction(null); 
                        onEntryChange();
                    }}
                    workout={activeWorkout}
                    userProfile={client}
                    calendarEventId={eventToAction?.id}
                    programId={eventToAction?.programId} 
                />
            )}

            <FullWorkoutHistoryDialog 
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                userProfile={client}
            />
        </div>
    );
}
