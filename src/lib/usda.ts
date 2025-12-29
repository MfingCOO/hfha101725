'use server';

import { FoodData } from '@/lib/usda-food-types';
import { z } from 'zod';

const FoodSearchResultSchema = z.array(z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
}));

export async function searchUSDA(query: string): Promise<z.infer<typeof FoodSearchResultSchema>> {
  // CORRECTED: Point to the internal API route that handles relevance scoring.
  // Use the full URL for server-side fetch.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/search`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error("[USDA Lib] Internal search API Error:", response.status, response.statusText);
      return [];
    }
    const data = await response.json();
    
    // The internal API returns a `results` property.
    if (!data.results) {
        return [];
    }

    // The data is already sorted by the backend, so we just need to parse it.
    return FoodSearchResultSchema.parse(data.results);

  } catch (error) {
    console.error("[USDA Lib] Failed to fetch or parse data from internal search API:", error);
    return [];
  }
}
