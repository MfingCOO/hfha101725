'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutLibrary } from '@/components/coach/workout-library/workout-library';

export function WorkoutBuilder() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Workout Library</CardTitle>
      </CardHeader>
      <CardContent>
        <WorkoutLibrary />
      </CardContent>
    </Card>
  );
}
