
export interface ScheduledEvent {
    id: string; // Unique identifier for the event
    type: 'workout' | 'appointment' | 'custom'; // Type of the event
    title: string; // The title of the event, e.g., "Leg Day" or "Check-in"
    startTime: string; // ISO 8601 string for the start time
    endTime: string; // ISO 8601 string for the end time
    userId: string; // The ID of the user this event belongs to
    relatedId?: string; // Optional ID to link to a specific Workout, etc.
    isCompleted: boolean; // Whether the user has marked the event as completed
    notes?: string; // Optional notes for the event
}
