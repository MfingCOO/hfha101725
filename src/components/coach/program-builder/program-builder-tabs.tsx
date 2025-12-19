'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseLibrary } from '@/components/coach/exercise-library/exercise-library';
import { WorkoutBuilder } from '@/components/coach/workout-builder/workout-builder';
import { ProgramBuilder } from '@/components/coach/program-builder/program-builder';

interface ProgramBuilderTabsProps {
  coachId: string;
}

export function ProgramBuilderTabs({ coachId }: ProgramBuilderTabsProps) {
  return (
    <Tabs defaultValue="exercises" className="w-full mt-2">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="exercises">Exercises</TabsTrigger>
        <TabsTrigger value="workouts">Workouts</TabsTrigger>
        <TabsTrigger value="programs">Programs</TabsTrigger>
      </TabsList>
      <TabsContent value="exercises">
        <ExerciseLibrary coachId={coachId} />
      </TabsContent>
      <TabsContent value="workouts">
        <WorkoutBuilder coachId={coachId} />
      </TabsContent>
      <TabsContent value="programs">
        <ProgramBuilder coachId={coachId} />
      </TabsContent>
    </Tabs>
  );
}
