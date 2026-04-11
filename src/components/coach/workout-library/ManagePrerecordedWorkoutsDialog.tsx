'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/auth/auth-provider';
import { 
  addPreRecordedWorkoutAction, 
  getPreRecordedWorkoutsAction, 
  uploadPreRecordedThumbnailAction,
  deletePreRecordedWorkoutAction 
} from '@/app/coach/actions/workout-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Upload, XCircle, Trash2, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const workoutSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  youtubeUrl: z.string().url('A valid YouTube URL is required'),
  thumbnailFile: z.instanceof(File).optional(),
});

type PreRecordedWorkout = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
};

interface ManagePrerecordedWorkoutsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// ==================== HELPER FUNCTIONS (from your original file) ====================
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const resizeImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const MAX_DIMENSION = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) height *= MAX_DIMENSION / width, width = MAX_DIMENSION;
        } else {
          if (height > MAX_DIMENSION) width *= MAX_DIMENSION / height, height = MAX_DIMENSION;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.8);
      };
    };
    reader.readAsDataURL(file);
  });
};
// ====================================================================================

export function ManagePrerecordedWorkoutsDialog({ isOpen, onOpenChange }: ManagePrerecordedWorkoutsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [workouts, setWorkouts] = useState<PreRecordedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(workoutSchema),
    defaultValues: { title: '', youtubeUrl: '', thumbnailFile: undefined as File | undefined },
  });

  const thumbnailFile = watch('thumbnailFile');

  useEffect(() => {
    if (thumbnailFile) {
      fileToDataUrl(thumbnailFile).then(setThumbnailPreview);
    } else {
      setThumbnailPreview(null);
    }
  }, [thumbnailFile]);

  const fetchWorkouts = async () => {
    setIsLoading(true);
    const result = await getPreRecordedWorkoutsAction();
    if (result.success) {
      setWorkouts(result.data || []);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchWorkouts();
  }, [isOpen]);

  const filteredWorkouts = workouts.filter(w => 
    w.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = async (data: z.infer<typeof workoutSchema>) => {
    if (!user || !data.thumbnailFile) {
      toast({ variant: 'destructive', title: 'Missing Thumbnail', description: 'Please upload a thumbnail.' });
      return;
    }

    try {
      const resizedFile = await resizeImage(data.thumbnailFile);
      const fileDataUrl = await fileToDataUrl(resizedFile);

      const uploadResult = await uploadPreRecordedThumbnailAction({
        fileDataUrl,
        fileName: resizedFile.name,
        fileType: resizedFile.type,          // ← this is the only new line
      });

      if (!uploadResult.success) throw new Error(uploadResult.error || 'Thumbnail upload failed');

      const workoutResult = await addPreRecordedWorkoutAction({
        title: data.title,
        youtubeUrl: data.youtubeUrl,
        thumbnailUrl: uploadResult.data.fileUrl,
        coachId: user.uid,
      });

      if (!workoutResult.success) throw new Error(workoutResult.error || 'Failed to save workout');

      toast({ title: 'Success', description: 'Pre-recorded workout added.' });
      reset();
      setIsFormVisible(false);
      fetchWorkouts();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: 'destructive', 
        title: 'Save Failed', 
        description: err.message || 'Unknown error occurred' 
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workout permanently?')) return;
    const result = await deletePreRecordedWorkoutAction(id);
    if (result.success) {
      toast({ title: 'Deleted successfully' });
      fetchWorkouts();
    } else {
      toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Pre-Recorded Workout Library</DialogTitle>
          <DialogDescription>All coaches share this library.</DialogDescription>
        </DialogHeader>

        {!isFormVisible ? (
          <>
            <Button onClick={() => setIsFormVisible(true)} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Workout
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workouts by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : filteredWorkouts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No workouts found.</p>
              ) : (
                filteredWorkouts.map(workout => (
                  <div key={workout.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <Image src={workout.thumbnailUrl} alt={workout.title} width={100} height={56} className="rounded-md object-cover" />
                    <div className="flex-1 min-w-0">
                      <Link href={workout.youtubeUrl} target="_blank" className="font-medium hover:underline block truncate">
                        {workout.title}
                      </Link>
                    </div>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(workout.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Controller name="title" control={control} render={({ field }) => <Input {...field} placeholder="Workout Title" />} />
            {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}

            <Controller name="youtubeUrl" control={control} render={({ field }) => <Input {...field} placeholder="YouTube Video URL" />} />
            {errors.youtubeUrl && <p className="text-red-500 text-xs">{errors.youtubeUrl.message}</p>}

            <div>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload Thumbnail
              </Button>
              <Input 
                type="file" 
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setValue('thumbnailFile', file, { shouldValidate: true });
                  }
                }}
              />
            </div>

            {thumbnailPreview && (
              <div className="relative w-40 aspect-video rounded-md overflow-hidden border">
                <Image src={thumbnailPreview} alt="Thumbnail preview" fill className="object-cover" />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-1 right-1 h-5 w-5"
                  onClick={() => {
                    setValue('thumbnailFile', undefined);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setIsFormVisible(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Workout
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}