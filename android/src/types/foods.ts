
import { z } from 'zod';

// Schema for individual nutrients
export const NutrientSchema = z.object({
  name: z.string(),
  amount: z.number(),
  unitName: z.string(),
});
export type Nutrient = z.infer<typeof NutrientSchema>;

// Schema for serving size options
export const ServingOptionSchema = z.object({
  description: z.string(),
  gramWeight: z.number(),
});
export type ServingOption = z.infer<typeof ServingOptionSchema>;

// Schema for additional food attributes, like gluten-free status
export const FoodAttributesSchema = z.object({
  isGlutenFree: z.boolean().optional(),
});
export type FoodAttributes = z.infer<typeof FoodAttributesSchema>;

// The most detailed and comprehensive schema for a food item.
// This is used for validation when data is sanitized.
export const FoodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
  foodCategory: z.string(),
  dataType: z.string(),
  servingOptions: z.array(ServingOptionSchema),
  nutrients: z.record(NutrientSchema), // Nutrients are a map with the nutrient name as the key
  attributes: FoodAttributesSchema.optional(),
  completenessScore: z.number().optional(),
});

// The TypeScript type derived from the FoodSchema
export type Food = z.infer<typeof FoodSchema>;

// Schema for the output of the USDA search tool
export const FoodSearchOutputSchema = z.object({
  brandedFoods: z.array(FoodSchema),
  foundationFoods: z.array(FoodSchema),
  otherFoods: z.array(FoodSchema),
});

// The TypeScript type derived from the FoodSearchOutputSchema
export type FoodSearchOutput = z.infer<typeof FoodSearchOutputSchema>;

// Schema for UPF analysis data, used within EnrichedFoodItem
export const UpfSchema = z.object({
  score: z.number(),
  classification: z.string(),
  reasoning: z.string(),
});
export type Upf = z.infer<typeof UpfSchema>;

// Schema for an enriched food item, which combines the base food data with UPF analysis
export const EnrichedFoodItemSchema = z.object({
  food: FoodSchema,
  upf: UpfSchema,
});
export type EnrichedFoodItem = z.infer<typeof EnrichedFoodItemSchema>;

// Schema for a meal saved by a user, consisting of multiple food items
export const SavedMealSchema = z.object({
    id: z.string(),
    name: z.string(),
    items: z.array(EnrichedFoodItemSchema),
});
export type SavedMeal = z.infer<typeof SavedMealSchema>;
