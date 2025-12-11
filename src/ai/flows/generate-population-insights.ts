'use server';
/**
 * @fileOverview Defines a Genkit flow for generating population-level insights.
 * THIS IS THE FINAL, CORRECT SYNTAX, using the project's custom configuredGenkit instance.
 */

import { z } from 'zod';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

// THE KEY: Import the project-specific configured instance of Genkit.
import { configuredGenkit } from '../genkit.config';

// Define the complex input schema for this specific flow
const PopulationInsightInputSchema = z.object({
  aggregateData: z.object({
    totalClients: z.number(),
    averageSleep: z.number().nullable(),
    averageUpfScore: z.number().nullable(),
    averageActivityMinutes: z.number().nullable(),
    totalCravingsLast7Days: z.number(),
    totalBingesLast7Days: z.number(),
    totalStressEventsLast7Days: z.number(),
  }),
  period: z.enum(['daily', 'weekly', 'monthly']),
});

const PopulationInsightOutputSchema = z.object({
    finding: z.string().describe('The single most important pattern, trend, or correlation discovered.'),
    explanation: z.string().describe('The likely \"why\" behind the pattern, explained simply.'),
    suggestion: z.string().describe('A concrete, actionable suggestion for coaches to address this trend.'),
});

// THE FIX: Call defineFlow as a method on our custom genkit instance.
export const generatePopulationInsightFlow = configuredGenkit.defineFlow(
  {
    name: 'generatePopulationInsightFlow',
    inputSchema: PopulationInsightInputSchema,
    outputSchema: PopulationInsightOutputSchema,
  },
  async ({ aggregateData, period }) => {
    const settings = await getSiteSettingsAction();
    const modelName = settings.data?.aiModelSettings?.pro;
    if (!modelName) {
      throw new Error("The 'Pro' AI model is not configured in settings.");
    }

    const dataString = JSON.stringify(aggregateData, null, 2);

    // THE FIX: Call generate as a method on our custom genkit instance.
    const response = await configuredGenkit.generate({
      model: modelName,
      prompt: `You are an expert data analyst for a wellness app. Analyze the following aggregate user data for the ${period} period and generate a key finding, a simple explanation, and an actionable suggestion for the coaches.`,
      output: {
        format: 'json',
        schema: PopulationInsightOutputSchema,
      },
      context: [
        { role: 'user', content: `Aggregate User Data to Analyze:\n\n${dataString}` }
      ],
    });

    const output = response.output;
    if (!output) {
      throw new Error("The AI model did not return a valid insight.");
    }

    return output;
  }
);
