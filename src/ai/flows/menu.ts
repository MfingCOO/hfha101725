import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const ai = genkit({
  plugins: [googleAI()],
});

export const menuFlow = ai.defineFlow(
  {
    name: 'menuFlow',
    inputSchema: z.object({
      prompt: z.string(),
      modelId: z.string(), // Pass siteSettings.aiModelSettings.flash here
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const llmResponse = await ai.generate({
      model: input.modelId, 
      prompt: `Analyze the following food item: ${input.prompt}. 
               Provide:
               1. Normal portion sizes.
               2. UPF (Ultra-Processed Food) percentage and justification.
               3. Gluten-free status and justification.
               4. Suggested healthy meals using this item.`,
      config: {
        temperature: 0.4, // Lower temperature is better for factual nutritional data
      },
    });

    return llmResponse.text; 
  }
);