'use client';

import { PerformanceLog, Workout, ExerciseBlock, Set, Exercise } from '@/types/workout-program';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LogDetailViewProps {
  log: PerformanceLog;
  workout: Workout;
  exercises: Map<string, Exercise>;
  unitSystem: 'metric' | 'imperial';
}

const KG_TO_LBS = 2.20462;
const convertKgToLbs = (kg: number) => Math.round((kg * KG_TO_LBS) * 2) / 2;

// Helper to find the specific performance data for a given set
const getSetPerformance = (log: PerformanceLog, blockId: string, setIndex: number) => {
    return log.performance.find(p => p.blockId === blockId && p.setIndex === setIndex);
};

export function LogDetailView({ log, workout, exercises, unitSystem }: LogDetailViewProps) {

  return (
    <div className="space-y-4">
        <div className="text-center">
            <h2 className="text-2xl font-bold">{workout.name}</h2>
            <p className="text-sm text-muted-foreground">
                Completed on {format(new Date(log.completedAt), "MMMM d, yyyy 'at' h:mm a")}
            </p>
        </div>

      {workout.blocks.map((block) => {
        if (block.type !== 'exercise') return null; // For now, we only display exercises
        
        const exercise = exercises.get(block.exerciseId);
        if (!exercise) return (
            <Card key={block.id} className="bg-muted/30">
                <CardHeader><CardTitle>Loading Exercise...</CardTitle></CardHeader>
            </Card>
        );

        return (
          <Card key={block.id} className="overflow-hidden">
            <CardHeader className='p-4'>
              <CardTitle className="text-lg">{exercise.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4 text-center">Set</TableHead>
                    <TableHead className="w-1/4 text-center">Target</TableHead>
                    <TableHead className="w-1/4 text-center">Completed</TableHead>
                    <TableHead className="w-1/4 text-center">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {block.sets.map((set, index) => {
                    const performance = getSetPerformance(log, block.id, index);
                    const targetValue = set.metric === 'time' ? `${set.value}s` : `${set.value} reps`;
                    const completedValue = performance ? (set.metric === 'time' ? `${performance.reps}s` : `${performance.reps} reps`) : 'N/A';
                    const weightValue = performance?.weight ? (unitSystem === 'imperial' ? `${convertKgToLbs(performance.weight)} lbs` : `${performance.weight} kg`) : 'N/A';

                    return (
                      <TableRow key={set.id}>
                        <TableCell className="text-center font-bold">{index + 1}</TableCell>
                        <TableCell className="text-center">{targetValue}</TableCell>
                        <TableCell className="text-center">{completedValue}</TableCell>
                        <TableCell className="text-center">{weightValue}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
