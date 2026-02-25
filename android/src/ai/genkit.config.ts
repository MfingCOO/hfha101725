// src/ai/genkit.config.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment variables. Google AI models will not work.');
}

export const configuredGenkit = genkit({
  plugins: [
    // Explicitly pass the API key to the googleAI plugin to ensure authentication.
    googleAI({ apiKey: GEMINI_API_KEY }),
  ],
});

console.log('Genkit core and Google AI plugin initialized globally!');
