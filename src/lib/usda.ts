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
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) {
    console.error("[USDA Lib] CRITICAL: USDA_API_KEY is not configured. Search will not work.");
    return [];
  }
  
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=50&dataType=Branded,SR%20Legacy,Foundation`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[USDA Lib] USDA API Error:", response.status, response.statusText);
      return [];
    }
    const data: FoodData = await response.json();
    if (!data.foods) {
        return [];
    }
    return FoodSearchResultSchema.parse(data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandOwner: food.brandOwner,
      ingredients: food.ingredients,
    })));
  } catch (error) {
    console.error("[USDA Lib] Failed to fetch or parse data from USDA API:", error);
    return [];
  }
}
