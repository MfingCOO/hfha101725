'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, XCircle, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { createLiveEvent, updateLiveEvent, uploadEventImageAction } from './actions';
import type { LiveEvent } from '@/types';
import Image from 'next/image';

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  eventDate: z.date({ required_error: 'Event date is required' }),
  eventTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  durationMinutes: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  attachVideoLink: z.boolean(),
  imageUrl: z.string().optional(),
});

interface UpsertEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpserted: () => void;
  initialData?: LiveEvent | null;
}

export function UpsertEventDialog({ open, onOpenChange, onEventUpserted, initialData }: UpsertEventDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const isEditMode = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      eventTime: '17:00',
      durationMinutes: 60,
      attachVideoLink: true,
      imageUrl: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const timestamp = initialData.eventTimestamp;
        const eventDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
        
        form.reset({
          title: initialData.title,
          description: initialData.description,
          eventDate: eventDate,
          eventTime: format(eventDate, 'HH:mm'),
          durationMinutes: initialData.durationMinutes,
          attachVideoLink: !!initialData.videoConferenceLink,
          imageUrl: (initialData as any).imageUrl || ''
        });
        setFilePreview((initialData as any).imageUrl || null);
      } else {
        form.reset({
          title: '',
          description: '',
          eventDate: undefined as any,
          eventTime: '17:00',
          durationMinutes: 60,
          attachVideoLink: true,
          imageUrl: '',
        });
        setFilePreview(null);
      }
    }
  }, [initialData, open, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated' });
      return;
    }

    setIsSubmitting(true);
    try {
      const eventTimestamp = new Date(values.eventDate);
      const [hours, minutes] = values.eventTime.split(':').map(Number);
      eventTimestamp.setHours(hours, minutes, 0, 0);
      
      const commonPayload = {
        title: values.title,
        description: values.description,
        eventTimestamp: eventTimestamp,
        durationMinutes: values.durationMinutes,
        coachId: user.uid,
        attachVideoLink: values.attachVideoLink,
        imageUrl: filePreview || undefined,
      };

      let result;
      if (isEditMode && initialData) {
        result = await updateLiveEvent({ 
            ...commonPayload, 
            eventId: initialData.id,
        });
      } else {
        result = await createLiveEvent(commonPayload);
      }
      
      if (result.success && filePreview && result.eventId) {
        await uploadEventImageAction(result.eventId, filePreview);
      }


      if (result.success) {
        toast({ title: 'Success', description: `Live event ${isEditMode ? 'updated' : 'created'} successfully.` });
        onEventUpserted();
        onOpenChange(false);
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Live Event' : 'Create New Live Event'}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the details for your live event.' 
              : 'Fill out the details below to schedule a new event for your clients.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl><Input placeholder="e.g., Weekly Q&A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe the event..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Event Image (Square)</FormLabel>
              <div className="flex items-center gap-4">
                {filePreview ? (
                  <div className="relative w-20 h-20 shrink-0 border rounded-md overflow-hidden bg-muted">
                    <Image src={filePreview} alt="Preview" fill className="object-cover" />
                    <button 
                      type="button" 
                      onClick={() => { setFilePreview(null); form.setValue('imageUrl', ''); }}
                      className="absolute top-0 right-0 p-0.5 bg-background/80 rounded-bl-md z-10"
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 shrink-0 border border-dashed rounded-md flex items-center justify-center bg-muted/50">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <FormControl>
                  <Input type="file" accept="image/*" onChange={handleFileChange} className="text-xs" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>

            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel className="mb-2">Event Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="eventTime"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Event Time (24h)</FormLabel>
                            <FormControl><Input placeholder="HH:mm" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (in minutes)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="attachVideoLink"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel>Attach Default Video Link</FormLabel>
                        <p className="text-sm text-muted-foreground">Includes the default video call link from your settings.</p>
                    </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isEditMode ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}