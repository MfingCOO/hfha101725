import { flow } from 'genkit';
import { z } from 'zod';
import { searchUsdaFoodDatabase } from '@/ai/tools/search-usda-food-database';
import { FoodSchema } from '@/types/foods';

const SearchInputSchema = z.object({ query: z.string() });

export const searchAndAnalyzeFoodsFlow = flow(
    {
        name: 'searchAndAnalyzeFoodsFlow',
        inputSchema: SearchInputSchema,
        outputSchema: z.array(FoodSchema),
        tools: [searchUsdaFoodDatabase],
    },
    async ({ query }) => {
        console.log(`Starting food search for query: \"${query}\"`);

        const searchResult = await searchUsdaFoodDatabase({ query });
        
        let allFoods = [
            ...searchResult.brandedFoods,
            ...searchResult.foundationFoods,
            ...searchResult.otherFoods,
        ];

        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(' ').filter(Boolean);

        allFoods.forEach(food => {
            const descriptionLower = food.description.toLowerCase();
            let relevanceScore = 0;

            if (descriptionLower.startsWith(queryLower)) {
                relevanceScore += 1000;
            }

            queryWords.forEach(word => {
                if (descriptionLower.includes(word)) {
                    relevanceScore += 100;
                }
            });

            if (food.dataType === 'Branded') {
                relevanceScore += 2;
            } else if (food.dataType === 'Foundation') {
                relevanceScore += 1;
            }

            relevanceScore -= descriptionLower.length * 0.5;

            food.completenessScore = relevanceScore;
        });

        allFoods.sort((a, b) => b.completenessScore - a.completenessScore);

        const top20 = allFoods.slice(0, 20);

        const validatedFoods = top20.map(food => ({
            ...food,
            nutrients: food.nutrients || {},
            servingOptions: food.servingOptions || [],
            attributes: food.attributes || {},
        }));

        console.log(`Found, sorted, and validated ${validatedFoods.length} food items.`);
        return validatedFoods;
    }
);
