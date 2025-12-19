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
import { Loader2, PlusCircle, Trash2, ChevronsUpDown, Check } from 'lucide-react';
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
                setWeeks(initialData.weeks || []);
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
        const newWeek: Partial<ProgramWeek> = { id: uuidv4(), weekNumber: weeks.length + 1, name: `Week ${weeks.length + 1}`, workoutId: '' };
        setWeeks([...weeks, newWeek]);
    };

    const handleRemoveWeek = (id: string) => {
        setWeeks(weeks.filter(week => week.id !== id).map((week, index) => ({ ...week, weekNumber: index + 1, name: `Week ${index + 1}` })));
    };
    
    const handleWeekNameChange = (id: string, name: string) => {
        setWeeks(weeks.map(week => week.id === id ? { ...week, name } : week));
    };

    const handleWorkoutSelect = (id: string, workoutId: string) => {
        setWeeks(weeks.map(week => week.id === id ? { ...week, workoutId } : week));
    };

    const handleSaveProgram = async () => {
        if (!programName) {
            toast({ title: "Program name is required", variant: "destructive" });
            return;
        }
        if (weeks.some(w => !w.workoutId)) {
            toast({ title: "All weeks must have a workout assigned", variant: "destructive"});
            return;
        }

        setIsSaving(true);
        const programData = { name: programName, description: programDescription, duration };
        const weeksData: ProgramWeek[] = weeks.map(w => ({
            id: w.id!,
            weekNumber: w.weekNumber!,
            name: w.name!,
            workoutId: w.workoutId!,
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
                        {duration !== 'continuous' && <Input type="number" value={weeks.length} onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value)) || 1)} className="w-24 mt-2" readOnly disabled/>}
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-md font-medium">Weekly Schedule</h3>
                        {weeks.map((week) => (
                            <div key={week.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                                <Input value={week.name!} onChange={(e) => handleWeekNameChange(week.id!, e.target.value)} className="flex-grow font-semibold h-9" />
                                {isLoadingWorkouts ? (
                                    <div className='w-full sm:w-56'><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : (
                                    <WorkoutSelector workouts={workouts} selectedWorkoutId={week.workoutId!} onSelect={(workoutId) => handleWorkoutSelect(week.id!, workoutId)} />
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveWeek(week.id!)} className="text-muted-foreground hover:text-destructive shrink-0">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
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

function WorkoutSelector({ workouts, selectedWorkoutId, onSelect }: { workouts: Workout[], selectedWorkoutId: string, onSelect: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const selectedWorkout = workouts.find(w => w.id === selectedWorkoutId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-56 justify-between h-9">
                    {selectedWorkout ? selectedWorkout.name : "Select..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No workouts found.</CommandEmpty>
                        <CommandGroup>
                            {workouts.map((workout) => (
                                <CommandItem key={workout.id} value={workout.name} onSelect={() => { onSelect(workout.id); setOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", selectedWorkoutId === workout.id ? "opacity-100" : "opacity-0")} />
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