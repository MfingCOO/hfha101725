'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkoutLibrary } from "@/components/coach/workout-library/workout-library";
import { ProgramLibrary } from "./program-library";
import { ExerciseLibrary } from "@/components/coach/exercise-library/exercise-library";

export function ProgramBuilderTabs() {
    return (
        <Tabs defaultValue="programs" className="h-full flex flex-col">
            <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="exercises">Exercises</TabsTrigger>
                <TabsTrigger value="workouts">Workouts</TabsTrigger>
                <TabsTrigger value="programs">Programs</TabsTrigger>
            </TabsList>
            <TabsContent value="exercises" className="flex-1 min-h-0 overflow-auto">
                 <ExerciseLibrary /> 
            </TabsContent>
            <TabsContent value="workouts" className="flex-1 min-h-0 overflow-auto">
                <WorkoutLibrary />
            </TabsContent>
            <TabsContent value="programs" className="flex-1 min-h-0 overflow-auto">
                <ProgramLibrary />
            </TabsContent>
        </Tabs>
    )
}
