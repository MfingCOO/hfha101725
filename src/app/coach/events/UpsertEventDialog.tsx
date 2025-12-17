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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { createLiveEvent, updateLiveEvent } from './actions';
import type { LiveEvent } from '@/types';

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  eventDate: z.date({ required_error: 'Event date is required' }),
  eventTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  durationMinutes: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  attachVideoLink: z.boolean(),
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
  const isEditMode = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      eventTime: '17:00',
      durationMinutes: 60,
      attachVideoLink: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const eventDate = new Date(initialData.eventTimestamp);
        form.reset({
          title: initialData.title,
          description: initialData.description,
          eventDate: eventDate,
          eventTime: format(eventDate, 'HH:mm'),
          durationMinutes: initialData.durationMinutes,
          attachVideoLink: !!initialData.videoConferenceLink,
        });
      } else {
        form.reset({
          title: '',
          description: '',
          eventDate: undefined,
          eventTime: '17:00',
          durationMinutes: 60,
          attachVideoLink: true,
        });
      }
    }
  }, [initialData, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated' });
      return;
    }

    setIsSubmitting(true);
    try {
      const [hours, minutes] = values.eventTime.split(':').map(Number);
      const eventTimestamp = new Date(values.eventDate);
      eventTimestamp.setHours(hours, minutes);

      // --- THE SURGICAL FIX ---
      // Construct a clean payload instead of spreading `...values` to prevent sending
      // the ambiguous `eventDate` and `eventTime` fields to the server.
      const payload = {
        title: values.title,
        description: values.description,
        durationMinutes: values.durationMinutes,
        attachVideoLink: values.attachVideoLink,
        eventTimestamp: eventTimestamp,
      };

      const result = isEditMode
        ? await updateLiveEvent({ ...payload, eventId: initialData!.id })
        : await createLiveEvent({ ...payload, coachId: user.uid });

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Live Event' : 'Create New Live Event'}</DialogTitle>
          <DialogDescription>{isEditMode ? 'Update the details for your live event.' : 'Fill out the details below to schedule a new event for your clients.'}</DialogDescription>
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
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col mt-2.5">
                        <FormLabel>Event Date</FormLabel>
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
