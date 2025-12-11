'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { FoodData, BrandedFoodItem } from '@/lib/usda-food-types';
import {
  EnrichedFood,
  Nutrient,
  UpfAnalysis,
  GlutenAnalysis,
  PortionSize,
  UpfPercentage,
  NovaGroup,
  UpfAnalysisSchema,
  UpfPercentageSchema,
  GlutenAnalysisSchema,
  PortionSizesSchema
} from '@/types';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const FoodSearchResultSchema = z.array(z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
}));

const convertTimestampsToISO = (data: any) => {
  if (!data) return data;
  const newData = { ...data };
  for (const key of Object.keys(newData)) {
    const value = newData[key];
    if (value instanceof Timestamp) {
      newData[key] = value.toDate().toISOString();
    } else if (value && typeof value.toDate === 'function') {
      newData[key] = value.toDate().toISOString();
    }
  }
  return newData;
}

export async function searchUSDA(query: string): Promise<z.infer<typeof FoodSearchResultSchema>> {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  // DEFINITIVE FIX 1: Add robust error handling and logging.
  if (!USDA_API_KEY) {
    console.error("[Food Cache] CRITICAL: USDA_API_KEY is not configured in environment variables. Search will not work.");
    return []; // Return empty array to prevent UI crash.
  }
  
  // DEFINITIVE FIX 2: Increase pageSize from 20 to 50 as requested.
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=50&dataType=Branded,SR%20Legacy,Foundation`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("[Food Cache] USDA API Error:", response.status, response.statusText);
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
    console.error("[Food Cache] Failed to fetch or parse data from USDA API:", error);
    return []; // Return empty array on other fetch/parse failures.
  }
}

// DEFINITIVE FIX for both the "0 kcal" bug and the silent save failure.
export async function getFoodDetails(fdcId: number) {
    const USDA_API_KEY = process.env.USDA_API_KEY;
    if (!USDA_API_KEY) {
        throw new Error("USDA API Key is not configured.");
    }
    const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${USDA_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const data: BrandedFoodItem = await response.json();

        const keyNutrientIds = {
            Calories: 1008,
            Protein: 1003,
            Fat: 1004,
            Carbs: 1005,
            Fiber: 1079,
        };

        const nutrientMap: Map<number, Nutrient> = new Map();

        // Process all available nutrients from the API.
        data.foodNutrients.forEach(n => {
            // Use a fallback for amount to prevent saving `undefined`.
            const amount = n.amount ?? 0;
            nutrientMap.set(n.nutrient.id, {
                id: n.nutrient.id,
                name: n.nutrient.name,
                amount: amount,
                unitName: n.nutrient.unitName.toLowerCase(),
            });
        });

        // Prioritize "Energy (Atwater General Factors)" (ID: 2047) if available.
        const atwaterEnergy = data.foodNutrients.find(n => n.nutrient.id === 2047);
        if (atwaterEnergy) {
             nutrientMap.set(keyNutrientIds.Calories, {
                id: keyNutrientIds.Calories,
                name: 'Energy',
                amount: atwaterEnergy.amount ?? 0,
                unitName: 'kcal',
            });
        } else if (!nutrientMap.has(keyNutrientIds.Calories)) {
            // If no Atwater and no regular Energy, add a zero-value placeholder.
            nutrientMap.set(keyNutrientIds.Calories, { id: keyNutrientIds.Calories, name: 'Energy', amount: 0, unitName: 'kcal' });
        }

        // Ensure all key nutrients have a default value if missing, preventing `undefined`.
        const finalNutrients: Nutrient[] = [];
        const nutrientDefinitions = {
            [keyNutrientIds.Calories]: { name: 'Energy', unit: 'kcal' },
            [keyNutrientIds.Protein]: { name: 'Protein', unit: 'g' },
            [keyNutrientIds.Fat]: { name: 'Total lipid (fat)', unit: 'g' },
            [keyNutrientIds.Carbs]: { name: 'Carbohydrate, by difference', unit: 'g' },
            [keyNutrientIds.Fiber]: { name: 'Fiber, total dietary', unit: 'g' },
        };

        for (const id in nutrientDefinitions) {
            const numId = Number(id);
            if (nutrientMap.has(numId)) {
                finalNutrients.push(nutrientMap.get(numId)!);
            } else {
                finalNutrients.push({
                    id: numId,
                    name: nutrientDefinitions[id as any].name,
                    amount: 0,
                    unitName: nutrientDefinitions[id as any].unit,
                });
            }
        }
        
        // Ensure `brandOwner` and `ingredients` are strings to prevent Firestore `undefined` error.
        return {
            fdcId: data.fdcId,
            description: data.description,
            brandOwner: data.brandOwner || '',
            ingredients: data.ingredients || '',
            nutrients: finalNutrients,
        };

    } catch (error) {
        console.error(`Failed to fetch details for FDC ID ${fdcId}:`, error);
        return null;
    }
}


export async function checkCachedStatus(fdcIds: number[]): Promise<number[]> {
  if (fdcIds.length === 0) {
    return [];
  }

  const foodCacheRef = adminDb.collection('global-food-cache');
  const cachedIds: number[] = [];
  const CHUNK_SIZE = 30; // Firestore 'in' query limit

  for (let i = 0; i < fdcIds.length; i += CHUNK_SIZE) {
    const chunk = fdcIds.slice(i, i + CHUNK_SIZE);
    const snapshot = await foodCacheRef.where('fdcId', 'in', chunk).get();
    snapshot.forEach(doc => {
      cachedIds.push(doc.data().fdcId);
    });
  }

  return cachedIds;
}


export async function getEnrichedFood(fdcId: number): Promise<EnrichedFood | null> {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
    const docSnap = await foodDocRef.get();

    if (!docSnap.exists) {
        return null;
    }
    
    return convertTimestampsToISO(docSnap.data()) as EnrichedFood;
}

export async function getOrEnrichFoodForUser(fdcId: number): Promise<EnrichedFood | null> {
  const cachedFood = await getEnrichedFood(fdcId);
  if (cachedFood) {
    return cachedFood;
  }

  const foodDetails = await getFoodDetails(fdcId);
  if (!foodDetails) {
    return null;
  }

  const aiInput = {
    description: foodDetails.description,
    ingredients: foodDetails.ingredients || '',
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }

  let enrichedDetailsFromAI: any;
  try {
    const response = await fetch(`${appUrl}/api/flows/enrichFoodDetailsFlow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: aiInput }),
    });

    if (!response.ok) {
      throw new Error(`AI flow failed with status ${response.status}`);
    }
    enrichedDetailsFromAI = await response.json();

  } catch (error) {
    console.error('Calling the AI enrichment flow failed.', error);
    enrichedDetailsFromAI = { result: {} }; // Ensure result property exists on failure
  }

  const fallbackUpfAnalysis: UpfAnalysis = { rating: NovaGroup.UNCLASSIFIED, justification: 'AI analysis failed.' };
  const fallbackUpfPercentage: UpfPercentage = { value: 0, justification: 'AI analysis failed.' };
  const fallbackGlutenAnalysis: GlutenAnalysis = { isGlutenFree: false, justification: 'AI analysis failed.' };

  const aiResult = enrichedDetailsFromAI?.result;
  const upfAnalysis = UpfAnalysisSchema.safeParse(aiResult?.upfAnalysis).data || fallbackUpfAnalysis;
  const upfPercentage = UpfPercentageSchema.safeParse(aiResult?.upfPercentage).data || fallbackUpfPercentage;
  const glutenAnalysis = GlutenAnalysisSchema.safeParse(aiResult?.glutenAnalysis).data || fallbackGlutenAnalysis;
  const portionSizes = PortionSizesSchema.safeParse(aiResult?.portionSizes).data || [];

  const newEnrichedFood: EnrichedFood = {
    ...foodDetails,
    fdcId: fdcId,
    source: 'AI_ANALYSIS',
    analysisDate: new Date().toISOString(),
    upfAnalysis,
    upfPercentage,
    glutenAnalysis,
    portionSizes,
  };

  try {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
    const { createdAt, updatedAt, ...restOfData } = newEnrichedFood;
    const dataToSave: any = {
        ...restOfData,
        analysisDate: Timestamp.fromDate(new Date(newEnrichedFood.analysisDate)),
        updatedAt: FieldValue.serverTimestamp(),
    };
    
    const docSnap = await foodDocRef.get();
    if (!docSnap.exists) {
      dataToSave.createdAt = FieldValue.serverTimestamp();
        await foodDocRef.set(dataToSave);
    } else {
        await foodDocRef.update(dataToSave);
    }

  } catch (error) {
    // DEFINITIVE FIX: Prevent server crash by handling the error gracefully.
    console.error("CRITICAL: Failed to save AI-enriched food to Firestore:", error);
    return null; 
  }

  return convertTimestampsToISO(newEnrichedFood) as EnrichedFood;
}

export async function saveManualEnrichedFood(foodData: EnrichedFood): Promise<{ success: boolean, error?: string }> {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(foodData.fdcId));

    try {
        const { createdAt, updatedAt, ...restOfFoodData } = foodData;

        const dataToSave: any = {
            ...restOfFoodData,
            analysisDate: Timestamp.fromDate(
                foodData.analysisDate && !isNaN(new Date(foodData.analysisDate).getTime()) 
                ? new Date(foodData.analysisDate) 
                : new Date()
            ),
            updatedAt: FieldValue.serverTimestamp(),
        };

        const docSnap = await foodDocRef.get();

        if (docSnap.exists) {
            await foodDocRef.update(dataToSave);
        } else {
          dataToSave.createdAt = FieldValue.serverTimestamp();
            await foodDocRef.set(dataToSave);
        }
        
        return { success: true };
    } catch(error) {
        console.error("CRITICAL ERROR: Failed to save enriched food to Firestore:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function deleteFoodFromCache(fdcId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
        await foodDocRef.delete();
        return { success: true };
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to delete food from Firestore:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}