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
