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

async function searchUSDA(
  query: string
): Promise<z.infer<typeof FoodSearchResultSchema>> {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) {
    console.error('[Food Search API] CRITICAL: USDA_API_KEY is not configured.');
    return [];
  }
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(
    query
  )}&pageSize=50&dataType=Branded,SR%20Legacy,Foundation`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const data: FoodData = await response.json();
    return FoodSearchResultSchema.parse(
      data.foods.map((food) => ({
        fdcId: food.fdcId,
        description: food.description,
        brandOwner: food.brandOwner,
        ingredients: food.ingredients,
      }))
    );
  } catch (error) {
    console.error(
      '[Food Search API] Failed to fetch or parse data from USDA API:',
      error
    );
    return [];
  }
}

async function searchAlgolia(query: string): Promise<HybridFoodSearchResult[]> {
  try {
    const { results } = await algoliaAdmin.search([
      {
        indexName: 'food_cache',
        params: {
          query: query,
          hitsPerPage: 50,
          removeWordsIfNoResults: 'allOptional', // Allow partial matches
        },
      },
    ]);

    const hits = (results[0] as any)?.hits || [];
    return hits.map((hit: any) => ({
      fdcId: hit.fdcId,
      description: hit.description,
      brandOwner: hit.brandOwner || '',
      isCached: true,
    }));
  } catch (error) {
    console.error('[Food Search API] Failed to search Algolia:', error);
    return [];
  }
}

export async function hybridFoodSearch(
  query: string,
  scope: 'all' | 'usda' | 'cached' = 'all'
) {
  'use server';
  if (query.length < 2) return [];

  // 1. Fetch results from both sources concurrently.
  const [usdaResults, algoliaResults] = await Promise.all([
    scope === 'all' || scope === 'usda'
      ? searchUSDA(query)
      : Promise.resolve([]),
    scope === 'all' || scope === 'cached'
      ? searchAlgolia(query)
      : Promise.resolve([]),
  ]);

  // 2. Combine results, prioritizing the cache and respecting provider ranking.
  const finalResults: HybridFoodSearchResult[] = [];
  const seenFdcIds = new Set<number>();

  // Add Algolia (cached) results first. Algolia's ranking is respected.
  algoliaResults.forEach(food => {
      if (!seenFdcIds.has(food.fdcId)) {
          finalResults.push({ ...food, isCached: true });
          seenFdcIds.add(food.fdcId);
      }
  });

  // Add USDA results for items that are not already in our cache.
  usdaResults.forEach(food => {
      if (!seenFdcIds.has(food.fdcId)) {
          finalResults.push({ ...food, isCached: false });
          seenFdcIds.add(food.fdcId);
      }
  });

  // 3. Filter results based on the requested scope.
  if (scope === 'cached') {
    return finalResults.filter(r => r.isCached);
  }
  if (scope === 'usda') {
    return finalResults.filter(r => !r.isCached);
  }
  
  return finalResults;
}
