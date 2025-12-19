'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { getWorkoutsAction } from '@/app/coach/actions/workout-actions';
import { Workout, Program, ProgramWeek } from '@/types/workout-program';
import { Loader2, PlusCircle, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Define the type directly in the file to bypass module resolution issues.
type ActionResponse<T> = 
  | { success: true; data: T; }
  | { success: false; error: string; };

// Mock function for saving a program - replace with your actual API call
async function saveProgramAction(program: Omit<Program, 'id'>): Promise<ActionResponse<Program>> {
    console.log("Saving program:", program);
    // In a real app, you would send this to your backend and get the saved program back
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simulate a success response
    return { success: true, data: { ...program, id: new Date().toISOString() } };
    // Simulate an error response
    // return { success: false, error: "Could not connect to the database." };
}


export function ProgramBuilder() {
    const { toast } = useToast();
    const [programName, setProgramName] = useState('');
    const [programDescription, setProgramDescription] = useState('');
    const [duration, setDuration] = useState<'continuous' | number>('continuous');
    const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
    
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchWorkouts = async () => {
            setIsLoadingWorkouts(true);
            const result = await getWorkoutsAction();
            if ('error' in result) {
                toast({
                    title: "Error fetching workouts",
                    description: result.error || "Could not load the workout library.",
                    variant: "destructive"
                });
            } else {
                setWorkouts(result.data);
            }
            setIsLoadingWorkouts(false);
        };
        fetchWorkouts();
    }, [toast]);

    const handleAddWeek = () => {
        const newWeek: ProgramWeek = {
            id: uuidv4(),
            weekNumber: weeks.length + 1,
            name: `Week ${weeks.length + 1}`,
            workoutId: ''
        };
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
        const programData: Omit<Program, 'id'> = {
            name: programName,
            description: programDescription,
            duration,
            weeks
        };
        
        const result = await saveProgramAction(programData);

        if ('error' in result) {
            toast({ title: "Error", description: result.error || "Failed to save the program.", variant: "destructive" });
        } else {
            toast({ title: "Program Saved!", description: `"${programName}" has been successfully saved.` });
            // Reset form
            setProgramName('');
            setProgramDescription('');
            setDuration('continuous');
            setWeeks([]);
        }
        setIsSaving(false);
    };

    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>Create a New Program</CardTitle>
                <CardDescription>Build a multi-week workout schedule for your clients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="continuous" id="continuous" />
                            <Label htmlFor="continuous">Continuous (Ongoing)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="weeks" id="weeks" />
                            <Label htmlFor="weeks">Specific Weeks</Label>
                        </div>
                    </RadioGroup>
                    {duration !== 'continuous' && (
                         <Input type="number" value={duration} onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value)) || 1)} className="w-24 mt-2" />
                    )}
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Weekly Schedule</h3>
                    {weeks.map((week, index) => (
                        <Card key={week.id} className="p-4 bg-muted/40">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 space-y-4 sm:space-y-0">
                                <Input 
                                    value={week.name} 
                                    onChange={(e) => handleWeekNameChange(week.id, e.target.value)} 
                                    className="flex-grow font-semibold"
                                />
                                {isLoadingWorkouts ? (
                                    <div className='w-full sm:w-64'><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : (
                                    <WorkoutSelector 
                                        workouts={workouts} 
                                        selectedWorkoutId={week.workoutId} 
                                        onSelect={(workoutId) => handleWorkoutSelect(week.id, workoutId)} 
                                    />
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveWeek(week.id)} className="text-muted-foreground hover:text-destructive self-end sm:self-center">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                     <Button onClick={handleAddWeek} variant="outline" className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Week
                    </Button>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveProgram} disabled={isSaving || weeks.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Program
                </Button>
            </CardFooter>
        </Card>
    );
}

function WorkoutSelector({ workouts, selectedWorkoutId, onSelect }: { workouts: Workout[], selectedWorkoutId: string, onSelect: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const selectedWorkout = workouts.find(w => w.id === selectedWorkoutId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full sm:w-64 justify-between"
                >
                    {selectedWorkout ? selectedWorkout.name : "Select a workout..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search workouts..." />
                    <CommandList>
                        <CommandEmpty>No workouts found.</CommandEmpty>
                        <CommandGroup>
                            {workouts.map((workout) => (
                                <CommandItem
                                    key={workout.id}
                                    value={workout.name}
                                    onSelect={() => {
                                        onSelect(workout.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedWorkoutId === workout.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
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