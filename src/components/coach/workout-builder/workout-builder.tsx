'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkoutBuilder() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Workout Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center text-muted-foreground py-10">
            <p>Coming soon!</p>
            <p className="text-sm">This is where you will create and manage individual workouts.</p>
        </div>
      </CardContent>
    </Card>
  );
}
