'use client';

import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getWorkoutsAction } from '@/app/coach/actions/workout-actions';
import { upsertProgramAction } from '@/app/coach/actions/program-actions';
import type { Workout, Program, ProgramWeek } from '@/types/workout-program';
import { Loader2, PlusCircle, Trash2, X, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProgramBuilderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onProgramSaved: () => void;
    initialData: Program | null;
}

export function ProgramBuilderDialog({ isOpen, onClose, onProgramSaved, initialData }: ProgramBuilderDialogProps) {
    const { toast } = useToast();
    const [programName, setProgramName] = useState('');
    const [programDescription, setProgramDescription] = useState('');
    const [duration, setDuration] = useState<'continuous' | number>('continuous');
    const [weeks, setWeeks] = useState<Partial<ProgramWeek>[]>([]);
    
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const dialogTitle = useMemo(() => initialData ? "Edit Program" : "Create a New Program", [initialData]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setProgramName(initialData.name);
                setProgramDescription(initialData.description || '');
                setDuration(initialData.duration);
                const sanitizedWeeks = initialData.weeks.map((week: any) => ({
                    ...week,
                    workoutIds: Array.isArray(week.workoutIds) ? week.workoutIds : (week.workoutId ? [week.workoutId] : [])
                }));
                setWeeks(sanitizedWeeks);
            } else {
                setProgramName('');
                setProgramDescription('');
                setDuration('continuous');
                setWeeks([]);
            }
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        const fetchWorkouts = async () => {
            setIsLoadingWorkouts(true);
            const result = await getWorkoutsAction();
            if (result.success === false) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                setWorkouts(result.data);
            }
            setIsLoadingWorkouts(false);
        };
        if (isOpen) {
            fetchWorkouts();
        }
    }, [isOpen, toast]);

    const handleAddWeek = () => {
        const newWeek: Partial<ProgramWeek> = { id: uuidv4(), weekNumber: weeks.length + 1, name: `Week ${weeks.length + 1}`, workoutIds: [] };
        setWeeks([...weeks, newWeek]);
    };

    const handleRemoveWeek = (id: string) => {
        setWeeks(weeks.filter(week => week.id !== id).map((week, index) => ({ ...week, weekNumber: index + 1, name: `Week ${index + 1}` })));
    };
    
    const handleWeekNameChange = (id: string, name: string) => {
        setWeeks(weeks.map(week => week.id === id ? { ...week, name } : week));
    };

    const handleAddWorkoutToWeek = (weekId: string, workoutId: string) => {
        setWeeks(weeks.map(week => {
            if (week.id === weekId) {
                return { ...week, workoutIds: [...(week.workoutIds || []), workoutId] };
            }
            return week;
        }));
    };

    const handleRemoveWorkoutFromWeek = (weekId: string, workoutIndex: number) => {
        setWeeks(weeks.map(week => {
            if (week.id === weekId) {
                const newWorkoutIds = [...(week.workoutIds || [])];
                newWorkoutIds.splice(workoutIndex, 1);
                return { ...week, workoutIds: newWorkoutIds };
            }
            return week;
        }));
    };

    const handleSaveProgram = async () => {
        if (!programName) {
            toast({ title: "Program name is required", variant: "destructive" });
            return;
        }
        if (weeks.some(w => !w.workoutIds || w.workoutIds.length === 0)) {
            toast({ title: "All weeks must have at least one workout assigned", variant: "destructive"});
            return;
        }

        setIsSaving(true);
        const programData = { name: programName, description: programDescription, duration };
        const weeksData: ProgramWeek[] = weeks.map(w => ({
            id: w.id!,
            weekNumber: w.weekNumber!,
            name: w.name!,
            workoutIds: w.workoutIds!,
        }));
        
        const result = await upsertProgramAction({ programData, weeksData, programId: initialData?.id || null });

        if (result.success === false) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Program Saved!", description: `"${programName}" has been successfully saved.` });
            onProgramSaved();
        }
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>Build a multi-week workout schedule for your clients.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
                    <div className="space-y-2">
                        <Label htmlFor="program-name">Program Name</Label>
                        <Input id="program-name" placeholder="e.g., 8-Week Strength Foundation" value={programName} onChange={e => setProgramName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="program-description">Description</Label>
                        <Textarea id="program-description" placeholder="A brief overview of the program's goals." value={programDescription} onChange={e => setProgramDescription(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>Program Duration</Label>
                        <RadioGroup value={duration === 'continuous' ? 'continuous' : 'weeks'} onValueChange={(value) => setDuration(value === 'continuous' ? 'continuous' : 8)} className="flex items-center gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="continuous" id="continuous" /><Label htmlFor="continuous">Continuous</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="weeks" id="weeks" /><Label htmlFor="weeks">Fixed Weeks</Label></div>
                        </RadioGroup>
                        {duration !== 'continuous' && <Input type="number" value={weeks.length} readOnly disabled className="w-24 mt-2" />}
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-md font-medium">Weekly Schedule</h3>
                        {weeks.map((week) => (
                            <div key={week.id} className="flex flex-col gap-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <Input value={week.name!} onChange={(e) => handleWeekNameChange(week.id!, e.target.value)} className="flex-grow font-semibold h-9" />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveWeek(week.id!)} className="text-muted-foreground hover:text-destructive shrink-0">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="pl-2 space-y-2">
                                    <Label className="text-xs text-muted-foreground">Assigned Workouts</Label>
                                    {week.workoutIds?.map((workoutId, index) => {
                                        const workout = workouts.find(w => w.id === workoutId);
                                        return (
                                            <div key={`${workoutId}-${index}`} className='flex items-center justify-between text-sm p-2 bg-background rounded-md shadow-sm'>
                                                <span>{`Day ${index + 1}: ${workout?.name || "Loading..."}`}</span>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveWorkoutFromWeek(week.id!, index)} className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                    {isLoadingWorkouts ? <Loader2 className="h-4 w-4 animate-spin" /> : <WorkoutMultiSelector workouts={workouts} assignedWorkoutIds={week.workoutIds || []} onSelect={(workoutId) => handleAddWorkoutToWeek(week.id!, workoutId)} />}
                                </div>
                            </div>
                        ))}
                        <Button onClick={handleAddWeek} variant="outline" className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Week
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSaveProgram} disabled={isSaving || weeks.length === 0}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Program
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function WorkoutMultiSelector({ workouts, assignedWorkoutIds, onSelect }: { workouts: Workout[], assignedWorkoutIds: string[], onSelect: (id: string) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Workout
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search workouts..." />
                    <CommandList>
                        <CommandEmpty>No workouts found.</CommandEmpty>
                        <CommandGroup>
                            {workouts.map((workout) => (
                                <CommandItem key={workout.id} value={workout.name} onSelect={() => { onSelect(workout.id); setOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                    {workout.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}