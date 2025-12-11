'use client';

import { z } from 'zod';
import { proactiveCoachingFlow } from '@/ai/flows/rag/proactive-coach';

const ClientActionInputSchema = z.object({
  uid: z.string(),
  eventType: z.enum(['binge', 'craving', 'stress']),
  eventDetails: z.string().optional(),
});

type ClientActionInput = z.infer<typeof ClientActionInputSchema>;

/**
 * This client-side action is the bridge between the UI and the server-side AI flow.
 * It transforms the data into the format expected by the AI and calls the flow.
 */
export async function triggerProactiveCoachingAction(input: ClientActionInput): Promise<string> {
  
  const flowInput = {
    clientId: input.uid,
    event: {
      type: input.eventType,
      notes: input.eventDetails,
    },
  };

  try {
    console.log('[Action] Triggering proactiveCoachingFlow with:', flowInput);
    
    const flowResult = await proactiveCoachingFlow.run(flowInput);
    const coachResponse = (flowResult as any).coachResponse;

    if (!coachResponse) {
      throw new Error('Flow completed but returned no response.');
    }

    return coachResponse;

  } catch (error) {
    console.error("[Action CRITICAL] Failed to execute proactiveCoachingFlow:", error);
    // We re-throw the error so the calling component can handle it.
    throw new Error(`Failed to get AI coaching insight. Please try again later.`);
  }
}
