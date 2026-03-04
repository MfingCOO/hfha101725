'use server';

import { algoliaAdmin } from '@/lib/algoliaAdmin';
import { FoodData } from '@/lib/usda-food-types';
import { HybridFoodSearchResult } from '@/types';
import { z } from 'zod';

const FoodSearchResultSchema = z.array(
  z.object({
    fdcId: z.number(),
    description: z.string(),
    brandOwner: z.string().optional(),
    ingredients: z.string().optional(),
  })
);

async function searchUSDA(query: string) {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) return [];
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=20`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: FoodData = await response.json();
    return data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner || '',
      ingredients: food.ingredients || '',
      source: 'usda'
    }));
  } catch (error) {
    return [];
  }
}

async function searchAlgolia(query: string): Promise<HybridFoodSearchResult[]> {
  try {
    const { results } = await algoliaAdmin.search([
      {
        indexName: 'food_cache',
        params: { query: query, hitsPerPage: 20 },
      },
    ]);

    const hits = (results[0] as any)?.hits || [];
    // CRITICAL: We map manually to ensure we only send PLAIN PRIMITIVES
    return hits.map((hit: any) => ({
      fdcId: Number(hit.fdcId),
      description: String(hit.description || ''),
      brandOwner: String(hit.brandOwner || ''),
      isCached: true,
    }));
  } catch (error) {
    return [];
  }
}

export async function hybridFoodSearch(query: string, scope: string = 'all') {
  if (query.length < 2) return [];

  const [usdaResults, algoliaResults] = await Promise.all([
    (scope === 'all' || scope === 'usda') ? searchUSDA(query) : Promise.resolve([]),
    (scope === 'all' || scope === 'cached') ? searchAlgolia(query) : Promise.resolve([]),
  ]);

  const finalResults: any[] = [];
  const seenFdcIds = new Set<number>();

  algoliaResults.forEach(food => {
    if (!seenFdcIds.has(food.fdcId)) {
      finalResults.push({ ...food, isCached: true });
      seenFdcIds.add(food.fdcId);
    }
  });

  usdaResults.forEach(food => {
    if (!seenFdcIds.has(food.fdcId)) {
      finalResults.push({ ...food, isCached: false });
      seenFdcIds.add(food.fdcId);
    }
  });
  
  return finalResults;
}