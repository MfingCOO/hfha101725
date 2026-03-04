import { Timestamp } from 'firebase-admin/firestore';

export interface ScheduledEvent {
    id: string;
    type: 'workout' | 'meal' | 'measurement' | 'custom';
    title: string;
    startTime: string; // ISO 8601 string
    endTime: string;   // ISO 8601 string
    userId: string;
    relatedId?: string; // e.g., workoutId, mealId
    isCompleted?: boolean;
    duration?: number; // Duration in minutes
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: Timestamp | Date | string;
    end: Timestamp | Date | string;
    isPersonal: boolean;
    coachId: string;
    coachName: string;
    clientId?: string;
    clientName?: string;
    notes?: string;
    isCoachBooking?: boolean;
    type?: 'live-event' | 'appointment' | 'workout';
    attendees?: string[];
    attendeeCount?: number;
    maxParticipants?: number;
    createdAt: Timestamp | Date | string;
    updatedAt?: Timestamp | Date | string;
}
