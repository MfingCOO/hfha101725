'use server';

import { z } from 'zod';
import { configuredGenkit } from '@/ai/genkit.config';
import { defineFlow, runFlow } from '@genkit-ai/flow';
import { NovaGroup } from '@/types';

// NOTE: The schemas are unchanged.
const EnrichedFoodDetailsSchema = z.object({
  upfAnalysis: z.object({
    rating: z.nativeEnum(NovaGroup),
    justification: z.string(),
  }),
  upfPercentage: z.object({
    value: z.number(),
    justification: z.string(),
  }),
  glutenAnalysis: z.object({
    isGlutenFree: z.boolean(),
    justification: z.string(),
  }).optional(),
  portionSizes: z.array(z.object({
    description: z.string(),
    gramWeight: z.number(),
  })),
});

const FoodDetailsInputSchema = z.object({
  description: z.string(),
  ingredients: z.string().optional(),
  modelName: z.string(),
});

// THIS IS THE FIX: The 'export' keyword is removed. 
// This is now a private constant within the file, which resolves the build error.
const pureEnrichFoodDetailsFlow = defineFlow(
  {
    name: 'pureEnrichFoodDetailsFlow',
    inputSchema: FoodDetailsInputSchema,
    outputSchema: EnrichedFoodDetailsSchema,
  },
  async ({ description, ingredients, modelName }) => {
    console.log('[AI Flow] Starting enrichment for:', description);
    console.log(`[AI Flow] Using model: ${modelName}`);

    const systemPrompt = `You are a world-class expert nutritionist and food scientist.`;

    const prompt = `
      **FOOD TO ANALYZE:**
      - Description: "${description}"
      - Ingredients: "${ingredients || 'Not provided'}"
      **Construct the JSON object now.**
    `;

    try {
      const llmResponse = await configuredGenkit.generate({
        model: modelName,
        system: systemPrompt,
        prompt: prompt,
        output: { schema: EnrichedFoodDetailsSchema },
        config: { temperature: 0.1 },
      });

      const output = llmResponse.output;
      if (!output) {
        throw new Error('Model returned an empty output.');
      }
      return output;
    } catch (error) {
      console.error(
        '[AI Flow CRITICAL] Flow failed during AI generation.',
        { food_description: description, error: error instanceof Error ? { name: error.name, message: error.message } : error }
      );
      return {
        upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: 'AI analysis failed.' },
        upfPercentage: { value: 0, justification: 'AI analysis failed.' },
        glutenAnalysis: { isGlutenFree: false, justification: 'AI analysis failed.' },
        portionSizes: [],
      };
    }
  }
);

// This Server Action is the only export, which is correct.
export const enrichFoodDetailsFlow = configuredGenkit.defineFlow(
  {
    name: 'enrichFoodDetailsFlow',
    inputSchema: FoodDetailsInputSchema,
    outputSchema: EnrichedFoodDetailsSchema,
  },
  async (input) => {
    // It can now safely call the private flow object.
    return await runFlow(pureEnrichFoodDetailsFlow, input);
  }
);
