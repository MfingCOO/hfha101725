'use server';
import { z } from 'zod';
import { configuredGenkit } from '@/ai/genkit.config';
import { NovaGroup } from '@/types/index';

const EnrichedFoodDetailsSchema = z.object({
  upfAnalysis: z.object({
    rating: z.nativeEnum(NovaGroup),
    justification: z.string(),
  }),
  upfPercentage: z.object({
    value: z.number().min(0).max(100),
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
  foodCategory: z.string().optional(),
  dataType: z.string().optional(),
  nutrients: z.record(z.string(), z.any()).optional(),
  modelName: z.string(),
});

export const enrichFoodDetailsFlow = configuredGenkit.defineFlow(
  {
    name: 'enrichFoodDetailsFlow',
    inputSchema: FoodDetailsInputSchema,
    outputSchema: EnrichedFoodDetailsSchema,
  },
  async ({ description, ingredients, foodCategory, dataType, nutrients, modelName }) => {
    
    const targetModel = modelName.startsWith('googleai/') 
      ? modelName 
      : `googleai/${modelName}`;

    const systemPrompt = `You are a world-class nutrition scientist specializing in food processing classification.

You will receive a food description, ingredients list (if available), foodCategory, dataType, and selected nutrients.

Calculate a precise **UPF Processing Percentage (0-100)** using these exact thresholds:
- 0–10%   = Whole / Minimally Processed
- 10–20%  = Processed
- >20%    = Ultra-Processed (UPF)

CRITICAL RULE: If the ingredients list is missing, empty, or very short (<4 ingredients), rely VERY heavily on the description field.

Strong processing keywords that push the score higher when seen in the description:
fried, breaded, battered, processed, instant, canned, smoked, cured, sweetened, flavored, seasoned, coated, extruded, reformed, reconstituted, pre-cooked, ready-to-eat, microwaveable.

Scoring Rules (apply cumulatively):
- Top 3 ingredients contain sugar, fat, refined carb, or flour → +25
- Contains any UPF marker (emulsifier, preservative, artificial sweetener/color/flavor, hydrogenated oil, protein isolate, modified starch, MSG, carrageenan, etc.) → +25 per major marker (max +50)
- Enrichment/fortification detected (added vitamins/minerals like iron, thiamine, folic acid) → +15
- More than 5 ingredients → +10 (more than 10 ingredients → +20)
- Branded dataType → +10
- High sugar (>10g/100g) or sodium (>500mg/100g) + low fiber (<2g/100g) → +10
- Description contains strong processing keywords (fried, breaded, instant, processed, etc.) → +20 to +40 depending on severity

Return ONLY valid JSON matching the schema. Never add extra text. Be precise and consistent.`;

    const prompt = `
**FOOD TO ANALYZE:**
- Description: "${description}"
- Ingredients: "${ingredients || 'Not provided'}"
- Category: "${foodCategory || 'Not provided'}"
- Data Type: "${dataType || 'Not provided'}"
- Key Nutrients: ${JSON.stringify(nutrients || {})}

Return the structured JSON enrichment now.
`;

    try {
      const llmResponse = await configuredGenkit.generate({
        model: targetModel,
        system: systemPrompt,
        prompt: prompt,
        output: { schema: EnrichedFoodDetailsSchema },
        config: { temperature: 0.0 },   // Zero temperature = maximum consistency
      });

      if (!llmResponse.output) throw new Error('Model returned empty output.');
      
      // Save to your food cache here
      // await saveToFoodCache(description, llmResponse.output);

      return llmResponse.output;
      
    } catch (error) {
      console.error('[AI FLOW ERROR]', error);
      return {
        upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: 'Analysis failed.' },
        upfPercentage: { value: 0, justification: 'Analysis failed.' },
        glutenAnalysis: { isGlutenFree: false, justification: 'Analysis failed.' },
        portionSizes: [],
      };
    }
  }
);