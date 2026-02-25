import { defineFlow, generate } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

export const initMenuFlow = () => defineFlow(
  {
    name: 'menuFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (prompt) => {
    const llmResponse = await generate({
      prompt: `You are a helpful AI that can suggest meals based on a given food item. Suggest a few meals that can be made with the following item: ${prompt}`,
      model: googleAI('gemini-pro'),
      config: {
        temperature: 0.7,
      },
    });

    return llmResponse.text();
  }
);
