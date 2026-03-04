import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment variables.');
}

export const configuredGenkit = genkit({
  plugins: [
    googleAI({ apiKey: GEMINI_API_KEY }),
  ],
});