'use server';
/**
 * @fileOverview Defines a Genkit flow for generating daily wellness insights.
 * THIS IS THE FINAL, CORRECT SYNTAX, using the project's custom configuredGenkit instance.
 */

import { z } from 'zod';
import { getSiteSettingsAction } from '@/app/actions/site-settings-actions';
import { getAllDataForPeriod } from '@/services/firestore';

// THE KEY: Import the project-specific configured instance of Genkit.
import { configuredGenkit } from '../genkit.config';

const InsightInputSchema = z.object({
  clientId: z.string(),
  days: z.number().positive(),
});

const InsightOutputSchema = z.object({
  calories: z.string().describe('A summary of daily calorie intake and expenditure.'),
  macros: z.string().describe('An analysis of macronutrient distribution (protein, carbs, fat).'),
  hydration: z.string().describe('An evaluation of daily water intake.'),
  recommendation: z.string().describe('A key recommendation for the client based on the analysis.'),
});

// SURGICAL ADDITION: Export the inferred Zod type for use on the client.
export type GenerateInsightOutput = z.infer<typeof InsightOutputSchema>;


// THE FIX: Call defineFlow as a method on our custom genkit instance.
export const generateInsightFlow = configuredGenkit.defineFlow(
  {
    name: 'generateInsightFlow',
    inputSchema: InsightInputSchema,
    outputSchema: InsightOutputSchema,
  },
  async ({ clientId, days }) => {
    const [settings, journalEntries] = await Promise.all([
      getSiteSettingsAction(),
      getAllDataForPeriod(days, clientId),
    ]);

    const modelName = settings.data?.aiModelSettings?.pro;
    if (!modelName) {
      throw new Error("The 'Pro' AI model is not configured in settings.");
    }

    if (!journalEntries || !journalEntries.data || journalEntries.data.length === 0) {
      throw new Error("No journal entries found.");
    }

    const dataString = JSON.stringify(journalEntries.data, null, 2);

    // THE FIX: Call generate as a method on our custom genkit instance.
    const response = await configuredGenkit.generate({
      model: modelName,
      prompt: `Analyze the user's journal data and provide a concise summary. Format as JSON matching the schema.`,
      output: {
        format: 'json',
        schema: InsightOutputSchema,
      },
      context: [
        { role: 'user', content: `Journal Data (past ${days} days):\n\n${dataString}` }
      ],
    });

    const output = response.output;
    if (!output) {
      throw new Error("The AI model did not return a valid insight.");
    }

    return output;
  }
);
