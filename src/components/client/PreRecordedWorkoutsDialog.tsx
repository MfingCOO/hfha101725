'use client';
import { useState, useEffect, useMemo } from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Input } from '@/components/ui/input';
import { getPreRecordedWorkoutsAction } from '@/app/coach/actions/workout-actions';
import { Loader2, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

type PreRecordedWorkout = {
    id: string;
    title: string;
    youtubeUrl: string;
    thumbnailUrl: string;
};

interface PreRecordedWorkoutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PreRecordedWorkoutsDialog({ isOpen, onClose }: PreRecordedWorkoutsDialogProps) {
  const [workouts, setWorkouts] = useState<PreRecordedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchWorkouts = async () => {
        setIsLoading(true);
        const result = await getPreRecordedWorkoutsAction();
        if (result.success) {
          setWorkouts(result.data);
        }
        // Silently fail for users, but log for developers
        if (!result.success) {
          console.error("Failed to fetch pre-recorded workouts:", result.error);
        }
        setIsLoading(false);
      };
      fetchWorkouts();
    }
  }, [isOpen]);

  const filteredWorkouts = useMemo(() => {
    if (!searchTerm) {
      return workouts;
    }
    return workouts.filter(workout =>
      workout.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [workouts, searchTerm]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prerecorded Workout Library"
      description="Browse and search for workouts."
    >
      <div className="p-4">
        <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search by title..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : filteredWorkouts.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            <p>{searchTerm ? 'No workouts match your search.' : 'No pre-recorded workouts available yet.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
            {filteredWorkouts.map(workout => (
              <Link href={workout.youtubeUrl} key={workout.id} target="_blank" rel="noopener noreferrer" className="group">
                <div className="aspect-video relative rounded-lg overflow-hidden border">
                    <Image 
                        src={workout.thumbnailUrl} 
                        alt={workout.title} 
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                </div>
                <p className="mt-2 text-sm font-medium truncate group-hover:underline">{workout.title}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
