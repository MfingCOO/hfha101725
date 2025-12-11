'use server';

import { z } from 'zod';
import { configuredGenkit } from '@/ai/genkit.config';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import { NovaGroup } from '@/types';

// DEFINITIVE FIX: Use z.nativeEnum(NovaGroup) to ensure type consistency.
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
});

export const enrichFoodDetailsFlow = configuredGenkit.defineFlow(
  {
    name: 'enrichFoodDetailsFlow',
    inputSchema: FoodDetailsInputSchema,
    outputSchema: EnrichedFoodDetailsSchema,
  },
  async (food) => {
    console.log('[AI Flow] Starting enrichment for:', food.description);
    const settings = await getSiteSettingsAction();
    const modelNameFromDb = settings.data?.aiModelSettings?.pro;

    if (!modelNameFromDb) {
      console.error('[AI Flow CRITICAL] Pro AI model not configured in site settings.');
      throw new Error("CRITICAL: The 'Pro' AI model has not been configured in site settings.");
    }
    const modelName = `googleai/${modelNameFromDb}`;
    console.log(`[AI Flow] Using model: ${modelName}`);

    const systemPrompt = `You are a world-class expert nutritionist and food scientist. Your task is to analyze a given food item and return a structured JSON object with your analysis. Your tone must be expert, direct, and factual. You will only ever respond with a valid JSON object, with no other text, conversation, or explanation. Your output must conform to this Zod schema: ${JSON.stringify(EnrichedFoodDetailsSchema.shape)}`;

    // AI PROMPT CORRECTION: Added explicit UPF rating rules with the correct 'UPF' label.
    const prompt = `
      **PRIMARY GOAL: Construct a JSON object that accurately analyzes the food item.**

      **METHODOLOGY FOR UPF ANALYSIS:**
      1.  **Analyze Ingredients:** Examine the ingredient list. If missing, use your expert knowledge to find typical ingredients. Classify ingredients based on the NOVA system (Group 1: Unprocessed, Group 2: Processed Culinary, Group 3: Processed, Group 4: Ultra-Processed).
      2.  **Calculate UPF Percentage:** Estimate the percentage of the food's composition from Group 4 (UPF) ingredients.
      3.  **Determine UPF Rating:** Based *only* on the calculated UPF Percentage, you MUST assign the rating using the following strict rules:
          - If UPF Percentage is less than 10, the rating MUST be 'whole_food'.
          - If UPF Percentage is between 10 and 20 (inclusive), the rating MUST be 'processed'.
          - If UPF Percentage is greater than 20, the rating MUST be 'UPF'.

      **METHODOLOGY FOR GLUTEN ANALYSIS:**
      1.  **Scan for Gluten:** Review the ingredient list for common sources of gluten.
      2.  **Identify Keywords:** Look for 'wheat', 'barley', 'rye', 'malt', and 'brewer\'s yeast'. Also consider derivatives like 'semolina', 'durum', 'farro', and 'spelt'.
      3.  **Make Determination:**
          *   If a gluten keyword is present (and not part of an explicit "gluten-free" item like "gluten-free wheat starch"), you MUST set 'isGlutenFree' to 'false'.
          *   If no such ingredients are found, set 'isGlutenFree' to 'true'.
      4.  **Justify:** Briefly state the reason (e.g., "Contains wheat flour." or "No gluten-containing ingredients were identified.").

      **PORTION SIZE GUIDELINES:**
      *   Provide 3-5 realistic, common portion sizes (e.g., "1 taco", "1 slice", "1 cup").
      *   Do not use a generic "100g" serving unless it is the most logical portion.

      **FOOD TO ANALYZE:**
      - Description: "${food.description}"
      - Ingredients: "${food.ingredients || 'Not provided'}"

      **Construct the JSON object now.**
    `;

    try {
      console.log('[AI Flow] Sending request to model...');
      const llmResponse = await configuredGenkit.generate({
        model: modelName,
        system: systemPrompt,
        prompt: prompt,
        output: { 
          schema: EnrichedFoodDetailsSchema, 
        },
        config: { temperature: 0.1 },
      });

      const output = llmResponse.output;
      if (!output) {
        console.error('[AI Flow CRITICAL] Model returned an empty output.');
        throw new Error('Model returned an empty output.');
      }
      
      console.log('[AI Flow] Successfully received and validated model output.');
      return output;

    } catch (error) {
      // DETAILED ERROR LOGGING
      console.error(
        '[AI Flow CRITICAL] The flow failed during AI generation or output validation.',
        {
          food_description: food.description,
          error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
        }
      );
      
      // DEFINITIVE FIX: Use the NovaGroup enum to ensure type safety.
      return {
        upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: 'AI analysis failed.' },
        upfPercentage: { value: 0, justification: 'AI analysis failed.' },
        glutenAnalysis: { isGlutenFree: false, justification: 'AI analysis failed.' },
        portionSizes: [],
      };
    }
  }
);
