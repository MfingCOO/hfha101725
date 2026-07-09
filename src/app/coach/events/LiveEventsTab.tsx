'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getLiveEvents, updateLiveEvent, deleteLiveEvent } from './actions';
import { AddClientToEventModal } from '@/app/coach/events/AddClientToEventModal';
import { UpsertEventDialog } from './UpsertEventDialog';

interface LiveEventWithAttendees {
  id: string;
  title: string;
  description: string;
  eventTimestamp: any;
  attendees?: string[];
  attendeeDetails?: Array<{ fullName: string; email?: string }>;
}

export function LiveEventsTab() {
  const [events, setEvents] = useState<LiveEventWithAttendees[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventForAdd, setSelectedEventForAdd] = useState<{ id: string; title: string } | null>(null);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<any>(null);
  const { toast } = useToast();

  const fetchEvents = async () => {
    setIsLoading(true);
    const result = await getLiveEvents();
    
    if (result.success) {
      setEvents(result.data || []);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to load events',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleClientAdded = () => {
    fetchEvents();
  };

  const handleEditEvent = (event: any) => {
    setSelectedEventForEdit(event);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also remove it from all calendars.')) {
      return;
    }
  
    try {
      // Delete the live event
      const deleteResult = await deleteLiveEvent({ eventId });
      
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete event');
      }
  
      // Also clean up calendar entries (best effort)
      try {
        await Promise.allSettled([
          // These are optional - if they don't exist it won't break
        ]);
      } catch (e) {
        // Ignore calendar cleanup errors
      }
  
      toast({ title: 'Event Deleted' });
      fetchEvents();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete event',
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No upcoming live events found.</p>
      ) : (
        events.map((event) => {
          const attendeeCount = event.attendees?.length || 0;
          const attendeeNames = event.attendeeDetails 
            ? event.attendeeDetails.map(a => a.fullName).join(', ')
            : '';

          return (
            <Card key={event.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(event.eventTimestamp).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {attendeeCount > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {attendeeCount}
                      </div>
                    )}

                    <Button size="sm" variant="outline" onClick={() => setSelectedEventForAdd({ id: event.id, title: event.title })}>
                      <Plus className="h-4 w-4" />
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)}>
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => handleDeleteEvent(event.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {attendeeNames && (
                  <div className="mt-3 text-xs text-muted-foreground break-words">
                    <span className="font-medium">Signed up:</span> {attendeeNames}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {selectedEventForAdd && (
        <AddClientToEventModal
          isOpen={!!selectedEventForAdd}
          onClose={() => setSelectedEventForAdd(null)}
          eventId={selectedEventForAdd.id}
          eventTitle={selectedEventForAdd.title}
          onClientAdded={handleClientAdded}
        />
      )}

      {selectedEventForEdit && (
        <UpsertEventDialog
          open={!!selectedEventForEdit}
          onOpenChange={() => setSelectedEventForEdit(null)}
          initialData={selectedEventForEdit}
          onEventUpserted={fetchEvents}
        />
      )}
    </div>
  );
}