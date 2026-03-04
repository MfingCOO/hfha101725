'use client';

import * as React from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import type { Challenge } from '@/types'; // FIX: Import Challenge type directly from types
import { format, eachDayOfInterval, startOfDay, isSameDay, isToday, differenceInCalendarDays, parseISO } from 'date-fns';
import { logChallengeProgressAction, getAllDataForPeriod } from '@/services/firestore';
import { getCustomHabitsAction } from '@/app/coach/habits/actions';
import { pillarsAndTools } from '@/lib/pillars';
import { BaseModal } from '@/components/ui/base-modal';
import { AppNumberInput } from '../ui/number-input';

// Locally defined types to avoid breaking changes
interface CustomHabit {
    id: string;
    name: string;
    description: string;
}

type SerializableChallenge = Omit<Challenge, 'dates' | 'createdAt' | 'progress'> & {
    dates: { from: string, to: string };
    createdAt?: string;
    progress?: {
        [userId: string]: {
            [date: string]: {
                [task: string]: boolean | number;
            }
        }
    };
};

interface ClientChallengeDetailModalProps {
    challenge: SerializableChallenge;
    isOpen: boolean;
    onClose: () => void;
}

// Helper to determine if a task should be shown on a given day based on its recurrence rules
const isTaskVisibleOnDate = (task: any, currentDay: Date, challengeStartDate: Date): boolean => {
    if (!task.days || task.days.length === 0) return true; // Always show if no specific days are set

    const dayOfWeek = format(currentDay, 'eee').toLowerCase();
    if (!task.days.includes(dayOfWeek)) return false; // Hide if it's not the right day of the week

    // Handle custom recurrence intervals (e.g., every 3 days)
    if (task.recurrenceType === 'custom' && task.recurrenceInterval) {
        const dayDifference = differenceInCalendarDays(currentDay, challengeStartDate);
        if (dayDifference < 0) return false;
        return dayDifference % task.recurrenceInterval === 0;
    }

    return true; // Show for weekly recurrences that match the day
};

// --- DAILY TASKS COMPONENT ---
// Renders the checklist for a single day. Memoized to prevent UI lag.
const DailyTasks = React.memo(({
    currentDay,
    challenge,
    userLogs,
    customHabits,
    getTaskProgressValue,
    isPillarTaskCompleteAutomatically,
    handleProgressChange,
}: any) => {

    const challengeStartDate = useMemo(() => startOfDay(parseISO(challenge.dates.from)), [challenge.dates.from]);

    // Combine all task types into a single renderable list
    const tasksForDay = useMemo(() => {
        const allTasks: any[] = [];
        if (challenge.scheduledPillars) allTasks.push(...challenge.scheduledPillars.map((p: any) => ({ ...p, taskType: 'pillar' })));
        if (challenge.customTasks) allTasks.push(...challenge.customTasks.map((t: any) => ({ ...t, taskType: 'custom' })));
        if (challenge.scheduledHabits) allTasks.push(...challenge.scheduledHabits.map((h: any) => ({ ...h, taskType: 'habit' })));
        
        return allTasks.filter(task => isTaskVisibleOnDate(task, currentDay, challengeStartDate));
    }, [challenge, currentDay, challengeStartDate]);

    if (tasksForDay.length === 0) {
        return <div className="text-center p-8 text-sm text-muted-foreground">No tasks scheduled for today.</div>;
    }

    return (
        <ScrollArea className="flex-1">
            <div className="p-4 pt-2 space-y-3">
                {tasksForDay.map((task: any, index: number) => {
                    const taskId = `${task.taskType}-${task.id || task.description || index}`;
                    
                    // --- RENDER PILLAR LOGGING TASK ---
                    if (task.taskType === 'pillar') {
                        const pillar = pillarsAndTools.find(p => p.id === task.pillarId);
                        if (!pillar) return null;
                        const taskDescription = `Log ${pillar.label}`;
                        const isAutoCompleted = isPillarTaskCompleteAutomatically(currentDay, pillar.id);
                        const isManuallyCompleted = !!getTaskProgressValue(taskDescription);
                        const isCompleted = isAutoCompleted || isManuallyCompleted;

                        return (
                            <div key={taskId} className="flex items-center space-x-3 p-3 rounded-md bg-muted/50">
                                <Checkbox
                                    id={`${format(currentDay, 'yyyy-MM-dd')}-${pillar.id}`}
                                    checked={isCompleted}
                                    onCheckedChange={(checked) => handleProgressChange(taskDescription, !!checked)}
                                    disabled={isAutoCompleted}
                                />
                                <Label htmlFor={`${format(currentDay, 'yyyy-MM-dd')}-${pillar.id}`} className={cn("flex-1", isCompleted && "line-through text-muted-foreground")}>
                                    {taskDescription}
                                </Label>
                                {/* FIX: Removed invalid title prop */}
                                {isAutoCompleted && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                            </div>
                        );
                    }

                    // --- RENDER CUSTOM TASK (BOOLEAN OR NUMERIC) ---
                    if (task.taskType === 'custom') {
                        const progressValue = getTaskProgressValue(task.description);
                        
                        // Numeric input task
                        if (task.goalType === 'user-records') {
                            return (
                                <div key={taskId} className="flex flex-col gap-2 p-3 rounded-md bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={taskId} className="flex-1 text-sm">{task.description}</Label>
                                        <AppNumberInput
                                            id={taskId}
                                            placeholder="0"
                                            value={progressValue as number | string || ''}
                                            onChange={(value) => handleProgressChange(task.description, value)}
                                            className="h-8 text-sm w-20"
                                            min={0}
                                        />
                                        <span className="text-sm text-muted-foreground">{task.unit}</span>
                                    </div>
                                    {task.notes && (
                                        <div className="text-xs text-muted-foreground flex gap-2 items-start pt-1 border-t border-white/10">
                                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                            <span>{task.notes}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        
                        // Standard checkbox task
                        const isCompleted = !!progressValue;
                        return (
                            <div key={taskId} className="p-3 rounded-md bg-muted/50 space-y-2">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id={taskId}
                                        checked={isCompleted}
                                        onCheckedChange={(checked) => handleProgressChange(task.description, !!checked)}
                                    />
                                    <Label htmlFor={taskId} className={cn("flex-1", isCompleted && "line-through text-muted-foreground")}>
                                        {task.description}
                                    </Label>
                                </div>
                                 {task.notes && (
                                    <div className="text-xs text-muted-foreground flex gap-2 items-start pt-2 border-t border-white/10">
                                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span>{task.notes}</span>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // --- RENDER HABIT TASK ---
                    if (task.taskType === 'habit') {
                         const habitDetails = customHabits.find((h: any) => h.id === task.habitId) || { name: `Habit ${index + 1}` };
                         const isCompleted = !!getTaskProgressValue(habitDetails.name);
                         return (
                            <div key={taskId} className="p-3 rounded-md bg-muted/50">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id={taskId}
                                        checked={isCompleted}
                                        onCheckedChange={(checked) => handleProgressChange(habitDetails.name, !!checked)}
                                    />
                                    <Label htmlFor={taskId} className={cn("flex-1", isCompleted && "line-through text-muted-foreground")}>
                                        {habitDetails.name}
                                    </Label>
                                </div>
                            </div>
                         );
                    }

                    return null;
                })}
            </div>
        </ScrollArea>
    );
});
DailyTasks.displayName = 'DailyTasks';

// --- MAIN MODAL COMPONENT ---
export function ClientChallengeDetailModal({ challenge: initialChallenge, isOpen, onClose }: ClientChallengeDetailModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [challenge, setChallenge] = useState(initialChallenge);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userLogs, setUserLogs] = useState<any[]>([]);
    const [customHabits, setCustomHabits] = useState<CustomHabit[]>([]);
    const [unsavedProgress, setUnsavedProgress] = useState<Record<string, boolean | number>>({});
    const hasUnsavedChanges = Object.keys(unsavedProgress).length > 0;
    const [dataLoadError, setDataLoadError] = useState<string | null>(null);

    // Fetch all required data when the modal opens
    const fetchInitialData = useCallback(async () => {
        if (!user) return; // Guard against null user
        setIsLoading(true);
        setDataLoadError(null);
        try {
            // Fetch all logs from the start of the challenge to today.
            const challengeStartDate = startOfDay(parseISO(initialChallenge.dates.from));
            const daysToFetch = Math.max(0, differenceInCalendarDays(new Date(), challengeStartDate) + 1);

            const [logsResult, habitsResult] = await Promise.all([
                // FIX: Added null check for user before accessing uid
                getAllDataForPeriod(daysToFetch, user.uid, challengeStartDate),
                getCustomHabitsAction()
            ]);

            if (logsResult.success) {
                setUserLogs(logsResult.data || []);
            } else {
                throw new Error(logsResult.error || 'Could not load your activity logs.');
            }
            if (habitsResult.success) {
                setCustomHabits(habitsResult.data || []);
            }
        } catch (error: any) {
            setDataLoadError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialChallenge.dates.from]);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setChallenge(initialChallenge); // Ensure challenge data is fresh on each open
        }
    }, [isOpen, initialChallenge, fetchInitialData]);

    const days = useMemo(() => {
        const from = parseISO(initialChallenge.dates.from);
        const to = parseISO(initialChallenge.dates.to);
        return eachDayOfInterval({ start: from, end: to });
    }, [initialChallenge.dates.from, initialChallenge.dates.to]);
    
    const todayIndex = useMemo(() => days.findIndex(day => isToday(day)), [days]);
    const [currentDayIndex, setCurrentDayIndex] = useState(todayIndex > -1 ? todayIndex : 0);
    
    // Reset component state when date changes
    useEffect(() => {
        setUnsavedProgress({});
    }, [currentDayIndex]);

    useEffect(() => {
        if(isOpen) {
          setCurrentDayIndex(todayIndex > -1 ? todayIndex : 0);
        }
    }, [isOpen, todayIndex])

    const currentDay = days[currentDayIndex];
    
    // Update local state for unsaved progress for immediate UI feedback
    const handleProgressChange = useCallback((taskDescription: string, value: boolean | number | '') => {
        const progressValue = value === '' ? 0 : value; // Treat empty input as 0
        setUnsavedProgress(prev => ({
            ...prev,
            [taskDescription]: progressValue,
        }));
    }, []);
    
    // Save the unsaved progress to Firestore
    const handleSaveProgress = useCallback(async () => {
        if (!user || !currentDay || !hasUnsavedChanges) return;
        setIsSaving(true);
        const dateString = format(startOfDay(currentDay), 'yyyy-MM-dd');
        try {
            const result = await logChallengeProgressAction({
                userId: user.uid,
                challengeId: challenge.id,
                date: dateString,
                progress: unsavedProgress,
            });

            if (result.success) {
                // After successful save, merge the changes into the main challenge state
                setChallenge(prev => {
                    const newProgress = { ...prev.progress };
                    if (!user) return prev; // Should not happen due to guard, but for type safety
                    if (!newProgress[user.uid]) newProgress[user.uid] = {};
                    if (!newProgress[user.uid][dateString]) newProgress[user.uid][dateString] = {};
                    newProgress[user.uid][dateString] = {
                        ...newProgress[user.uid][dateString],
                        ...unsavedProgress,
                    };
                    return { ...prev, progress: newProgress };
                });
                setUnsavedProgress({}); // Clear the unsaved state
                toast({ title: "Progress Saved!", description: "Your progress for the day has been updated." });
            } else {
                throw new Error(result.error || 'Failed to save progress.');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    }, [user, currentDay, hasUnsavedChanges, challenge.id, unsavedProgress, toast]);

    // Check for existing progress, prioritizing unsaved changes
    const getTaskProgressValue = useCallback((taskDescription: string) => {
        const dateString = format(startOfDay(currentDay), 'yyyy-MM-dd');
        if (unsavedProgress.hasOwnProperty(taskDescription)) {
            return unsavedProgress[taskDescription];
        }
        // FIX: Added null check for user
        if (!user) return undefined;
        return challenge.progress?.[user.uid]?.[dateString]?.[taskDescription];
    }, [challenge.progress, currentDay, unsavedProgress, user]);

    // Core logic to determine if a pillar task was completed automatically
    const isPillarTaskCompleteAutomatically = useCallback((date: Date, pillarId: string): boolean => {
        if (!date || !userLogs) return false;
        
        // Sleep logs are for the day the user WAKES UP
        if (pillarId === 'sleep') {
            // FIX: Corrected typo from `wakeUp-day` to `wakeUpDay`
            return userLogs.some(log => log.pillar === 'sleep' && log.wakeUpDay && isSameDay(parseISO(log.wakeUpDay), date));
        }
        
        // Hydration needs to check against a goal
        if (pillarId === 'hydration') {
             const todaysHydration = userLogs
                .filter(l => l.pillar === 'hydration' && l.entryDate && isSameDay(parseISO(l.entryDate), date))
                .reduce((sum, l) => sum + (l.amount || 0), 0);
            const goal = 64; // Assuming a static goal for now
            return todaysHydration >= goal;
        }

        // All other pillars just need one log entry for the day
        return userLogs.some(log => log.pillar === pillarId && log.entryDate && isSameDay(parseISO(log.entryDate), date));
    }, [userLogs]);

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={initialChallenge.title}
            description={initialChallenge.description}
            className="w-[95vw] max-w-lg h-[80vh]"
        >
            <div className="flex flex-col h-full">
                <div className="p-2 flex items-center justify-between gap-1 flex-shrink-0 bg-background/50">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))} disabled={currentDayIndex === 0}>
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div className="text-center">
                        <p className="font-bold">{format(currentDay, 'MMMM do, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">Day {currentDayIndex + 1} of {days.length}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDayIndex(i => Math.min(days.length - 1, i + 1))} disabled={currentDayIndex === days.length - 1}>
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                </div>
                {isLoading ? (
                    <div className="flex-1 flex justify-center items-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : dataLoadError ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                        <p className="text-destructive font-semibold">Could not load activity data.</p>
                        <p className="text-xs text-muted-foreground">{dataLoadError}</p>
                    </div>
                ) : (
                    <DailyTasks
                        currentDay={currentDay}
                        challenge={challenge}
                        userLogs={userLogs}
                        customHabits={customHabits}
                        getTaskProgressValue={getTaskProgressValue}
                        isPillarTaskCompleteAutomatically={isPillarTaskCompleteAutomatically}
                        handleProgressChange={handleProgressChange}
                    />
                )}
                {hasUnsavedChanges && (
                    <div className="p-4 pt-2 flex-shrink-0">
                        <Button onClick={handleSaveProgress} disabled={isSaving} className="w-full">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Progress
                        </Button>
                    </div>
                )}
            </div>
        </BaseModal>
    );
}