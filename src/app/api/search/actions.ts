'use server';

import { algoliaAdmin } from '@/lib/algoliaAdmin';
import { FoodData } from '@/lib/usda-food-types';
import { HybridFoodSearchResult } from '@/types';

type UsdaSearchResult = {
  fdcId: number;
  description: string;
  brandOwner: string;
};

async function searchAlgolia(query: string, exact: boolean): Promise<HybridFoodSearchResult[]> {
  try {
      const { results } = await algoliaAdmin.search([
          {
              indexName: 'food_cache',
              params: {
                  query: query,
                  hitsPerPage: exact ? 25 : 50,
                  
                  // THE FIX: Allow words to be found in different attributes
                  // but still keep typo tolerance off for the exact pass.
                  typoTolerance: exact ? false : 'min',
                  queryType: 'prefixLast', 
                  
                  // If 'MTS Protein' is searched, try to find both. 
                  // If only 'MTS' is found, still show it but rank it lower.
                  removeWordsIfNoResults: exact ? 'allOptional' : 'lastWords',
                  
                  // Ensures 'MTS' matches the brand field specifically
                  optionalFilters: [`brandOwner:${query.split(' ')[0]}`],
                  
                  // Essential for multi-attribute matching (Brand + Description)
                  advancedSyntax: true,
              },
          }          
      ]);
      
      const hits = (results[0] as any)?.hits || [];    
      return hits.map((hit: any) => ({
          fdcId: Number(hit.fdcId),
          description: hit.description,
          brandOwner: hit.brandOwner || '',
          isCached: true,
          source: 'LOCAL' as const,
      }));
  } catch (error) {
      return [];
  }
}

async function searchUSDA(query: string, exact: boolean): Promise<UsdaSearchResult[]> {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) return [];

  const cleanQuery = query.trim();
  const searchQuery = exact ? `"${cleanQuery}"` : cleanQuery;
  // Increased pageSize to 50 for more comprehensive results
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(searchQuery)}&pageSize=50&dataType=Branded,Survey (FNDDS)`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: FoodData = await response.json();
    return data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner || '',
    }));
  } catch (error) {
    console.error('USDA Search Error:', error);
    return [];
  }
}

/**
 * Priority Hierarchy:
 * 1. Exact Cache (LOCAL)
 * 2. Exact USDA
 * 3. Partial Cache (LOCAL)
 * 4. Partial USDA
 */
export async function hybridFoodSearch(query: string, scope: string = 'all') {
  if (query.length < 2) return [];

  // Step 1: Run BOTH Exact and Partial in parallel for maximum speed
  const [algoliaExact, usdaExactRaw, algoliaPartial, usdaPartialRaw] = await Promise.all([
    searchAlgolia(query, true),
    searchUSDA(query, true),
    searchAlgolia(query, false),
    searchUSDA(query, false)
  ]);

  // Step 2: Tag the USDA results
  const usdaExact = usdaExactRaw.map(food => ({ ...food, isCached: false, source: 'USDA' as const, rank: 2 }));
  const algoliaExactRanked = algoliaExact.map(food => ({ ...food, rank: 1 }));
  
  const usdaPartial = usdaPartialRaw.map(food => ({ ...food, isCached: false, source: 'USDA' as const, rank: 4 }));
  const algoliaPartialRanked = algoliaPartial.map(food => ({ ...food, rank: 3 }));

  // Step 3: Create the Master List
  // We use a Map to ensure fdcId is unique (don't show the same food twice)
  const resultsMap = new Map<number, any>();

  // Add them in order of priority: Local Exact > USDA Exact > Local Partial > USDA Partial
  [...algoliaExactRanked, ...usdaExact, ...algoliaPartialRanked, ...usdaPartial].forEach(item => {
    if (!resultsMap.has(item.fdcId)) {
      resultsMap.set(item.fdcId, item);
    }
  });

  // Convert back to array and maintain the rank order
  return Array.from(resultsMap.values()).sort((a, b) => a.rank - b.rank);
}