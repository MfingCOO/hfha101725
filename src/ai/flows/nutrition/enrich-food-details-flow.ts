'use server';
import { z } from 'zod';
import { configuredGenkit } from '@/ai/genkit.config';
import { NovaGroup } from '@/types/index';

// 1. Define Schemas (Must be present for the flow to find them)
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

// 2. Define Flow
export const enrichFoodDetailsFlow = configuredGenkit.defineFlow(
  {
    name: 'enrichFoodDetailsFlow',
    inputSchema: FoodDetailsInputSchema,
    outputSchema: EnrichedFoodDetailsSchema,
  },
  async ({ description, ingredients, modelName }) => {
    // NORMALIZATION: Safely handle "gemini-2.5-flash" from production Firestore
    // while satisfying the Genkit requirement for "googleai/" prefix.
    const targetModel = modelName.startsWith('googleai/') 
      ? modelName 
      : `googleai/${modelName}`;
    
    console.log(`[AI FLOW] Logic Check: Input="${modelName}" -> Target="${targetModel}"`);
    
    const systemPrompt = `You are a world-class expert nutritionist. Analyze food and provide structured JSON data including NOVA rating, gluten status, and common portion sizes.`;

    const prompt = `
      **FOOD TO ANALYZE:**
      - Description: "${description}"
      - Ingredients: "${ingredients || 'Not provided'}"
      
      Return the structured JSON enrichment now.
    `;

    try {
      const llmResponse = await configuredGenkit.generate({
        model: targetModel, 
        system: systemPrompt,
        prompt: prompt,
        output: { schema: EnrichedFoodDetailsSchema },
        config: { temperature: 0.1 },
      });

      if (!llmResponse.output) throw new Error('Model returned empty output.');
      return llmResponse.output;
      
    } catch (error) {
      console.error('[AI FLOW ERROR]', error);
      // Return safe fallback so the UI doesn't crash
      return {
        upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: 'Analysis failed.' },
        upfPercentage: { value: 0, justification: 'Analysis failed.' },
        glutenAnalysis: { isGlutenFree: false, justification: 'Analysis failed.' },
        portionSizes: [],
      };
    }
  }
);