
import { NextResponse } from 'next/server';
import { FoodData } from '@/lib/usda-food-types';
import { z } from 'zod';
import { algoliaAdmin } from '@/lib/algoliaAdmin';
import { HybridFoodSearchResult } from '@/types';

// Define schemas and helpers specifically for this route
const FoodSearchResultSchema = z.array(z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
}));

async function searchUSDA(query: string): Promise<z.infer<typeof FoodSearchResultSchema>> {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) {
    console.error("[Food Search API] CRITICAL: USDA_API_KEY is not configured.");
    return []; 
  }
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=150&dataType=Branded,SR%20Legacy,Foundation`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[Food Search API] USDA API Error:", response.status, response.statusText);
      return [];
    }
    const data: FoodData = await response.json();
    return FoodSearchResultSchema.parse(data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner,
      ingredients: food.ingredients,
    })));
  } catch (error) {
    console.error("[Food Search API] Failed to fetch or parse data from USDA API:", error);
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
                  hitsPerPage: 150,
                },
              }          
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

const getSearchScore = (result: HybridFoodSearchResult, query: string): number => {
    const description = result.description.toLowerCase();
    let score = 0;
    if (description === query) score = 300;
    else if (description.startsWith(query)) score = 200;
    else if (description.includes(query)) score = 100;

    if (score > 0 && result.isCached) {
        score += 10;
    }
    return score;
};

// The main POST handler for this API route
export async function POST(request: Request) {
  try {
    const { query, scope } = await request.json();

    if (typeof query !== 'string' || query.length < 2) {
      return NextResponse.json([], { status: 200 });
    }
    
    const lowercasedQuery = query.toLowerCase();

    const [usdaResults, algoliaResults] = await Promise.all([
        (scope === 'all' || scope === 'usda') ? searchUSDA(query) : Promise.resolve([]),
        (scope === 'all' || scope === 'cached') ? searchAlgolia(query) : Promise.resolve([])
    ]);

    const resultsMap = new Map<number, HybridFoodSearchResult>();
    algoliaResults.forEach(food => {
        resultsMap.set(food.fdcId, { ...food, isCached: true });
    });
    usdaResults.forEach(food => {
        if (!resultsMap.has(food.fdcId)) {
            resultsMap.set(food.fdcId, { ...food, isCached: false });
        }
    });
    const allResults = Array.from(resultsMap.values());

    let finalResults = allResults
        .map(result => ({ ...result, score: getSearchScore(result, lowercasedQuery) }))
        .filter(result => result.score > 0)
        .sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return a.description.localeCompare(b.description);
        });

    if (scope === 'cached') {
        finalResults = finalResults.filter(r => r.isCached);
    } else if (scope === 'usda') {
        finalResults = finalResults.filter(r => !r.isCached);
    }

    return NextResponse.json(finalResults);

  } catch (error) {
    console.error('[Food Search API] Internal Server Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
