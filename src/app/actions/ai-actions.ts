'use client';

import { z } from 'zod';
// REMOVED: import { proactiveCoachingFlow } from '@/ai/flows/rag/proactive-coach';

/**
 * NOTE: The Proactive Coaching Action has been decommissioned.
 * The RAG-based coaching flow was removed to reduce overhead and 
 * infrastructure costs for the initial Play Store launch.
 */

/* export const ClientActionInputSchema = z.object({
  uid: z.string(),
  eventType: z.enum(['binge', 'craving', 'stress']),
  eventDetails: z.string().optional(),
});

export async function triggerProactiveCoachingAction(input: any): Promise<string> {
  throw new Error("This feature is currently disabled.");
}
*/