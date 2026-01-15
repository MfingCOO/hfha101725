'use server';
import { tool } from 'genkit';
import { z } from 'zod';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { HybridFoodSearchResult } from '@/types';

// Define a schema for a single search result, adding isDirectMatch
const FoodSearchResultSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  isCached: z.boolean(),
  relevanceScore: z.number(),
  isDirectMatch: z.boolean(),
});

// Define the output schema for the tool
const ToolOutputSchema = z.object({
  results: z.array(FoodSearchResultSchema),
});

// Enhanced helper to calculate a more nuanced relevance score
const calculateRelevance = (description: string, brandOwner: string | undefined, query: string): number => {
    const lowerDesc = description.toLowerCase();
    const lowerBrand = (brandOwner || '').toLowerCase();
    const lowerQuery = query.toLowerCase();
    let score = 0;

    // Score for full/partial phrase matches
    if (lowerDesc.includes(lowerQuery)) score += 50;
    if (lowerBrand.includes(lowerQuery)) score += 40; // Brand match is important

    // Score for individual word matches
    const queryWords = new Set(lowerQuery.split(' ').filter(w => w.length > 1));
    if (queryWords.size === 0) return score;

    const descWords = new Set(lowerDesc.split(' '));
    const brandWords = new Set(lowerBrand.split(' '));
    
    let matchedWords = 0;
    queryWords.forEach(word => {
        if (descWords.has(word)) matchedWords++;
        if (brandWords.has(word)) matchedWords++;
    });
    score += (matchedWords / queryWords.size) * 10;

    return score;
};

export const searchUsdaFoodDatabase = tool(
  {
    name: 'searchUsdaFoodDatabase',
    description: 'Searches the local food cache and USDA FoodData Central database for a given food item query, returning a prioritized and relevance-scored list.',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: ToolOutputSchema,
  },
  async ({ query }) => {
    if (query.length < 2) return { results: [] };
    console.log(`[searchUsdaFoodDatabase] Hybrid searching for: "${query}"`);

    const lowercasedQuery = query.toLowerCase();
    const queryWords = lowercasedQuery.split(' ').filter(w => w.length > 1);

    // 1. Perform local and USDA searches in parallel
    const localPromise = adminDb.collection('global-food-cache').get(); // Get all local items for now
    const usdaPromise = searchUSDA(query);
    const [localSnapshot, usdaResults] = await Promise.all([localPromise, usdaPromise]);

    // 2. Process, score, and categorize all results
    const resultsMap = new Map<number, z.infer<typeof FoodSearchResultSchema>>();

    const processFoodItem = (food: {fdcId: number, description: string, brandOwner?: string}, isCached: boolean) => {
        const lowerDesc = food.description.toLowerCase();
        const lowerBrand = (food.brandOwner || '').toLowerCase();

        const isDirectMatch = queryWords.some(word => lowerDesc.includes(word) || lowerBrand.includes(word));

        // Only process items that are a direct match
        if (isDirectMatch) {
            resultsMap.set(food.fdcId, {
                fdcId: food.fdcId,
                description: food.description,
                brandOwner: food.brandOwner || '',
                isCached,
                relevanceScore: calculateRelevance(food.description, food.brandOwner, query),
                isDirectMatch: true,
            });
        }
    };

    // Process local results
    localSnapshot.docs.forEach(doc => {
        const food = doc.data();
        processFoodItem(food, true);
    });

    // Process USDA results, avoiding duplicates that are already cached
    usdaResults.forEach(food => {
        if (!resultsMap.has(food.fdcId)) {
            processFoodItem(food, false);
        }
    });

    // 3. Sort results using the multi-level hierarchy
    const sortedResults = Array.from(resultsMap.values()).sort((a, b) => {
        // Tier 1: Cached items are supreme
        if (a.isCached && !b.isCached) return -1;
        if (!a.isCached && b.isCached) return 1;

        // Tier 2: Higher relevance score is better
        if (a.relevanceScore !== b.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
        }

        // Tier 3: Alphabetical as a final tie-breaker
        return a.description.localeCompare(b.description);
    });

    console.log(`[searchUsdaFoodDatabase] Found ${sortedResults.length} relevant items.`);
    return { results: sortedResults.slice(0, 50) }; // Return top 50 results
  }
);

// Internal helper to call the USDA API
async function searchUSDA(query: string): Promise<{fdcId: number, description: string, brandOwner?: string}[]> {
    const USDA_API_KEY = process.env.USDA_API_KEY;
    if (!USDA_API_KEY) {
        console.error("[searchUSDA] USDA_API_KEY is not configured.");
        return [];
    }
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                dataType: ['Branded', 'Foundation', 'SR Legacy'],
                pageSize: 200, // Fetch more to ensure we find relevant matches
            }),
        });

        if (!response.ok) {
            console.error('[searchUSDA] API response not OK:', response.status, response.statusText);
            return [];
        }
        const data = await response.json();
        return data.foods.map((food: any) => ({
            fdcId: food.fdcId,
            description: food.description,
            brandOwner: food.brandOwner,
        }));
    } catch (error) {
        console.error('[searchUSDA] An unexpected error occurred:', error);
        return [];
    }
}
