'use client';

import * as React from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, Info, Trophy, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';
import type { Challenge } from '@/types';
import { format, eachDayOfInterval, startOfDay, isSameDay, isToday, isFuture, differenceInCalendarDays, parseISO } from 'date-fns';
import { logChallengeProgressAction, getAllDataForPeriod } from '@/services/firestore';
import { getCustomHabitsAction } from '@/app/coach/habits/actions';
import { pillarsAndTools } from '@/lib/pillars';
import { BaseModal } from '@/components/ui/base-modal';
import { AppNumberInput } from '../ui/number-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TROPHY_DEFINITIONS } from '@/lib/trophies';

// Locally defined types
interface CustomHabit {
    id: string;
    name: string;
    description: string;
}

type SerializableChallenge = Omit<Challenge, 'dates' | 'createdAt' | 'progress'> & {
    name: string;
    description: string;
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

// --- STREAK AND TROPHY CALCULATION LOGIC ---

const getChallengeTaskNames = (challenge: SerializableChallenge, customHabits: CustomHabit[]) => {
    const taskNames = new Set<string>();
    challenge.scheduledPillars?.forEach(p => {
        const pillar = pillarsAndTools.find(pl => pl.id === p.pillarId);
        if(pillar) taskNames.add(`Log ${pillar.label}`);
    });
    challenge.customTasks?.forEach(t => taskNames.add(t.description));
    challenge.scheduledHabits?.forEach(h => {
        const habit = customHabits.find(ch => ch.id === h.habitId);
        if(habit) taskNames.add(habit.name);
    });
    return Array.from(taskNames);
};

const calculateStreaks = (challenge: SerializableChallenge, userId: string, customHabits: CustomHabit[]) => {
    const userProgress = challenge.progress?.[userId];
    if (!userProgress) return {};

    const allTasks = getChallengeTaskNames(challenge, customHabits);
    const streaks: { [task: string]: { current: number; best: number } } = {};

    const challengeDays = eachDayOfInterval({
        start: parseISO(challenge.dates.from),
        end: parseISO(challenge.dates.to),
    });

    allTasks.forEach(task => {
        let bestStreak = 0;
        let currentRun = 0;

        challengeDays.forEach(day => {
            if (isFuture(day) && !isToday(day)) return;
            const dateString = format(startOfDay(day), 'yyyy-MM-dd');
            if (userProgress[dateString]?.[task]) {
                currentRun++;
            } else {
                bestStreak = Math.max(bestStreak, currentRun);
                currentRun = 0;
            }
        });
        bestStreak = Math.max(bestStreak, currentRun);

        let currentStreak = 0;
        let dayPointer = startOfDay(new Date());
        while (dayPointer >= startOfDay(parseISO(challenge.dates.from))) {
            const dateString = format(dayPointer, 'yyyy-MM-dd');
            if (userProgress[dateString]?.[task]) {
                currentStreak++;
                dayPointer.setDate(dayPointer.getDate() - 1);
            } else {
                break;
            }
        }

        streaks[task] = { current: currentStreak, best: bestStreak };
    });
    return streaks;
}

// --- TROPHIES COMPONENT ---
const ChallengeTrophies = ({ challenge, user, customHabits }: { challenge: SerializableChallenge, user: { uid: string }, customHabits: CustomHabit[] }) => {
    const streaks = useMemo(() => calculateStreaks(challenge, user.uid, customHabits), [challenge, user.uid, customHabits]);
    const allTaskStreaks = Object.values(streaks);
    const bestOverallStreak = useMemo(() => Math.max(0, ...allTaskStreaks.map(s => s.best)), [allTaskStreaks]);
    const taskNames = useMemo(() => getChallengeTaskNames(challenge, customHabits), [challenge, customHabits]);

    return (
        <div className="p-1 mt-4">
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-center mb-3 text-foreground">Trophy Case</h3>
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    {TROPHY_DEFINITIONS.map(trophy => {
                        const isEarned = trophy.isEarned({ bestStreak: bestOverallStreak });
                        return (
                            <div key={trophy.id} className={cn("flex items-center gap-4 py-2", !isEarned && "opacity-40")}>
                                <trophy.icon className={cn("h-8 w-8", isEarned ? 'text-yellow-500' : 'text-muted-foreground')} />
                                <div>
                                    <p className="font-semibold">{trophy.name}</p>
                                    <p className="text-xs text-muted-foreground">{trophy.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold text-center mb-3 text-foreground">Your Streaks</h3>
                <div className="space-y-2">
                    {taskNames.length > 0 ? taskNames.map((task, index) => {
                        const streakData = streaks[task] || { current: 0, best: 0 };
                        return (
                            <div key={`${task}-${index}`} className="flex items-center justify-between p-3 rounded-md bg-muted/50 text-sm">
                                <p className="font-medium">{task}</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5" title="Current Streak">
                                        <Flame className="h-4 w-4 text-orange-500" />
                                        <span className="font-mono">{streakData.current}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5" title="Best Streak">
                                        <Trophy className="h-4 w-4 text-yellow-500" />
                                        <span className="font-mono">{streakData.best}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-sm text-center text-muted-foreground p-4">No tasks with streaks yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

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
        <div className="space-y-3">
            {tasksForDay.map((task: any, index: number) => {
                const taskId = `${task.taskType}-${task.id || task.description || index}`;
                
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
                            {isAutoCompleted && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                        </div>
                    );
                }

                if (task.taskType === 'custom') {
                    const progressValue = getTaskProgressValue(task.description);
                    
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
    const [activeTab, setActiveTab] = useState("tasks");
    const hasUnsavedChanges = Object.keys(unsavedProgress).length > 0;
    const [dataLoadError, setDataLoadError] = useState<string | null>(null);

    const fetchInitialData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setDataLoadError(null);
        try {
            const challengeStartDate = startOfDay(parseISO(initialChallenge.dates.from));
            const daysToFetch = Math.max(0, differenceInCalendarDays(new Date(), challengeStartDate) + 1);

            const [logsResult, habitsResult] = await Promise.all([
                getAllDataForPeriod(daysToFetch, user.uid, challengeStartDate),
                getCustomHabitsAction()
            ]);

            if (logsResult.success) setUserLogs(logsResult.data || []);
            else throw new Error(logsResult.error || 'Could not load your activity logs.');
            
            if (habitsResult.success) setCustomHabits(habitsResult.data || []);
            // Do not throw error if habits fail, it's not critical

        } catch (error: any) {
            setDataLoadError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, initialChallenge.dates.from]);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setChallenge(initialChallenge);
        }
    }, [isOpen, initialChallenge, fetchInitialData]);

    const days = useMemo(() => {
        const from = parseISO(initialChallenge.dates.from);
        const to = parseISO(initialChallenge.dates.to);
        return eachDayOfInterval({ start: from, end: to });
    }, [initialChallenge.dates.from, initialChallenge.dates.to]);
    
    const todayIndex = useMemo(() => days.findIndex(day => isToday(day)), [days]);
    const [currentDayIndex, setCurrentDayIndex] = useState(todayIndex > -1 ? todayIndex : 0);
    
    useEffect(() => {
        setUnsavedProgress({});
    }, [currentDayIndex, activeTab]);

    useEffect(() => {
        if(isOpen) {
          setCurrentDayIndex(todayIndex > -1 ? todayIndex : 0);
          setActiveTab('tasks');
        }
    }, [isOpen, todayIndex])

    const currentDay = days[currentDayIndex];
    
    const handleProgressChange = useCallback((taskDescription: string, value: boolean | number | '') => {
        const progressValue = value === '' ? 0 : value;
        setUnsavedProgress(prev => ({ ...prev, [taskDescription]: progressValue }));
    }, []);
    
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
                setChallenge(prev => {
                    const newProgress = { ...prev.progress };
                    if (!user || !newProgress[user.uid]?.[dateString]) return prev;
                    newProgress[user.uid][dateString] = { ...newProgress[user.uid][dateString], ...unsavedProgress };
                    return { ...prev, progress: newProgress };
                });
                setUnsavedProgress({});
                toast({ title: "Progress Saved!" });
            } else {
                throw new Error(result.error || 'Failed to save progress.');
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    }, [user, currentDay, hasUnsavedChanges, challenge.id, unsavedProgress, toast]);

    const getTaskProgressValue = useCallback((taskDescription: string) => {
        const dateString = format(startOfDay(currentDay), 'yyyy-MM-dd');
        if (unsavedProgress.hasOwnProperty(taskDescription)) return unsavedProgress[taskDescription];
        if (!user) return undefined;
        return challenge.progress?.[user.uid]?.[dateString]?.[taskDescription];
    }, [challenge.progress, currentDay, unsavedProgress, user]);

    const isPillarTaskCompleteAutomatically = useCallback((date: Date, pillarId: string): boolean => {
        if (!date || !userLogs) return false;
        if (pillarId === 'sleep') return userLogs.some(log => log.pillar === 'sleep' && log.wakeUpDay && isSameDay(parseISO(log.wakeUpDay), date));
        if (pillarId === 'hydration') {
             const todaysHydration = userLogs.filter(l => l.pillar === 'hydration' && l.entryDate && isSameDay(parseISO(l.entryDate), date)).reduce((sum, l) => sum + (l.amount || 0), 0);
            return todaysHydration >= 64;
        }
        return userLogs.some(log => log.pillar === pillarId && log.entryDate && isSameDay(parseISO(log.entryDate), date));
    }, [userLogs]);

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={initialChallenge.name} className="max-w-md">
            <div className="flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="tasks">Daily Tasks</TabsTrigger>
                        <TabsTrigger value="trophies">Trophies</TabsTrigger>
                        <TabsTrigger value="description">Description</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tasks">
                        <div className="p-2 flex items-center justify-between gap-1 flex-shrink-0 bg-background/50 border-y my-4">
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
                        <div className="-mx-4 px-4">
                            {isLoading ? (
                                <div className="flex-1 flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : dataLoadError ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-center p-4 h-48">
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
                        </div>
                    </TabsContent>

                    <TabsContent value="trophies">
                        {user ? (
                           <ChallengeTrophies challenge={challenge} user={user} customHabits={customHabits} />
                        ) : (
                            <div className="text-center p-8 text-sm text-muted-foreground">Log in to see your trophies.</div>
                        )}
                    </TabsContent>
                    
                    <TabsContent value="description">
                        <p className="text-sm text-muted-foreground p-4 mt-2">{initialChallenge.description}</p>
                    </TabsContent>
                </Tabs>
                
                {hasUnsavedChanges && activeTab === 'tasks' && (
                    <div className="pt-4 flex-shrink-0">
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
