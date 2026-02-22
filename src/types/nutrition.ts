
import { z } from "zod";

export enum NovaGroup {
    WHOLE_FOOD = "whole_food",
    PROCESSED = "processed",
    UPF = "UPF",
    UNCLASSIFIED = "UNCLASSIFIED",
    UNPROCESSED_OR_MINIMALLY_PROCESSED = "UNPROCESSED_OR_MINIMALLY_PROCESSED",
    PROCESSED_CULINARY_INGREDIENTS = "PROCESSED_CULINARY_INGREDIENTS",
}

export const UpfAnalysisSchema = z.object({
    rating: z.nativeEnum(NovaGroup),
    justification: z.string(),
});
export type UpfAnalysis = z.infer<typeof UpfAnalysisSchema>;

export const GlutenAnalysisSchema = z.object({
    isGlutenFree: z.boolean(),
    justification: z.string(),
});
export type GlutenAnalysis = z.infer<typeof GlutenAnalysisSchema>;

export const UpfPercentageSchema = z.object({
    value: z.number(),
    justification: z.string(),
});
export type UpfPercentage = z.infer<typeof UpfPercentageSchema>;

export const PortionSizeSchema = z.object({
    description: z.string(),
    gramWeight: z.number(),
});
export const PortionSizesSchema = z.array(PortionSizeSchema);
export type PortionSize = z.infer<typeof PortionSizeSchema>;

export const NutrientSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    amount: z.number(),
    unitName: z.string(),
});
export type Nutrient = z.infer<typeof NutrientSchema>;

export const EnrichedFoodSchema = z.object({
    fdcId: z.number(),
    description: z.string(),
    brandOwner: z.string().optional(),
    ingredients: z.string().optional(),
    nutrients: z.array(NutrientSchema),
    source: z.enum(['AI_ANALYSIS', 'USER_PROVIDED', 'MANUAL_BULK']),
    analysisDate: z.string(),
    upfAnalysis: UpfAnalysisSchema,
    glutenAnalysis: GlutenAnalysisSchema.optional(),
    upfPercentage: UpfPercentageSchema,
    portionSizes: PortionSizesSchema,
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    status: z.string().optional(),
    createdBy: z.string().optional(),
});
export type EnrichedFood = z.infer<typeof EnrichedFoodSchema>;

export interface Portion extends PortionSize {}

export const MealItemSchema = EnrichedFoodSchema.extend({
    quantity: z.number(),
    unit: z.string(),
    calories: z.number(),
});
export type MealItem = z.infer<typeof MealItemSchema>;

export interface SavedMeal {
  id: string;
  uid: string;
  name: string;
  items: MealItem[];
  totalCalories: number;
  createdAt: any;
}

export interface RecentFood extends EnrichedFood {
    lastLogged: any;
}
