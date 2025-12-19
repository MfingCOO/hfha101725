'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutLibrary } from '@/components/coach/workout-library/workout-library';

interface WorkoutBuilderProps {
  coachId: string;
}

export function WorkoutBuilder({ coachId }: WorkoutBuilderProps) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Workout Library</CardTitle>
      </CardHeader>
      <CardContent>
        <WorkoutLibrary coachId={coachId} />
      </CardContent>
    </Card>
  );
}
