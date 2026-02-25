'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PlusCircle, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { getProgramsAction, deleteProgramAction } from '@/app/coach/actions/program-actions';
import type { Program } from '@/types/workout-program';
import { useToast } from '@/hooks/use-toast';
import { ProgramBuilderDialog } from '@/components/coach/program-builder/program-builder-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function ProgramLibrary() {
    const { toast } = useToast();
    const [programs, setPrograms] = useState<Program[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState<Program | null>(null);
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, program: Program | null }>({ open: false, program: null });
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchPrograms = async () => {
        setIsLoading(true);
        const result = await getProgramsAction();
        if (result.success === false) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            setPrograms(result.data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPrograms();
    }, []);

    const handleNewProgram = () => {
        setEditingProgram(null);
        setIsDialogOpen(true);
    };

    const handleEditProgram = (program: Program) => {
        setEditingProgram(program);
        setIsDialogOpen(true);
    };
    
    const handleDeleteProgram = async () => {
        if (!deleteAlertState.program) return;
        setIsDeleting(true);
        const result = await deleteProgramAction(deleteAlertState.program.id);
        if (result.success === false) {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Program deleted successfully." });
            fetchPrograms(); // Re-fetch to update the list
        }
        setIsDeleting(false);
        setDeleteAlertState({ open: false, program: null });
    };

    const onProgramSaved = () => {
        setIsDialogOpen(false);
        fetchPrograms(); // Refresh the list after saving
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Program Library</CardTitle>
                    <CardDescription>Manage your client-ready programs.</CardDescription>
                </div>
                <Button onClick={handleNewProgram}>
                    <PlusCircle className="mr-2 h-4 w-4" /> New Program
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : programs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                        <p>You haven't created any programs yet.</p>
                        <p>Click "New Program" to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {programs.map(program => (
                            <Card key={program.id} className="p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold">{program.name}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{program.description}</p>
                                        <p className="text-xs text-muted-foreground">{program.weeks.length} weeks</p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditProgram(program)}>
                                                <Edit className="mr-2 h-4 w-4"/> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, program })} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>

            <ProgramBuilderDialog 
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onProgramSaved={onProgramSaved}
                initialData={editingProgram}
            />

            <AlertDialog open={deleteAlertState.open} onOpenChange={(open) => setDeleteAlertState({ open, program: open ? deleteAlertState.program : null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the program "{deleteAlertState.program?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProgram} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                             {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                             Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
