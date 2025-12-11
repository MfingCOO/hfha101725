
import { tool } from 'genkit';
import { z } from 'zod';

const SearchResultsSchema = z.array(z.any());

export const searchUsdaFoodDatabase = tool(
  {
    name: 'searchUsdaFoodDatabase',
    description: 'Searches the USDA FoodData Central database for a given food item query.',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({
      brandedFoods: SearchResultsSchema,
      foundationFoods: SearchResultsSchema,
      otherFoods: SearchResultsSchema,
    }),
  },
  async ({ query }) => {
    console.log(`[searchUsdaFoodDatabase] Searching for: "${query}"`);
    const USDA_API_KEY = process.env.USDA_API_KEY;
    if (!USDA_API_KEY) {
      throw new Error('USDA_API_KEY environment variable not set.');
    }

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          dataType: ['Branded', 'Foundation', 'SR Legacy'],
          pageSize: 50,
        }),
      });

      if (!response.ok) {
        console.error('[searchUsdaFoodDatabase] API response not OK:', response.status, response.statusText);
        const errorBody = await response.text();
        console.error('[searchUsdaFoodDatabase] Error body:', errorBody);
        throw new Error(`FoodData Central API request failed with status ${response.status}`);
      }

      const data = await response.json();

      const searchResults = {
        brandedFoods: data.foods.filter((f: any) => f.dataType === 'Branded'),
        foundationFoods: data.foods.filter((f: any) => f.dataType === 'Foundation'),
        otherFoods: data.foods.filter((f: any) => f.dataType !== 'Branded' && f.dataType !== 'Foundation'),
      };
      console.log(`[searchUsdaFoodDatabase] Found ${data.foods.length} total items.`);
      return searchResults;
    } catch (error) {
      console.error('[searchUsdaFoodDatabase] An unexpected error occurred:', error);
      throw error;
    }
  }
);
