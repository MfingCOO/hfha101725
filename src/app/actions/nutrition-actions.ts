'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';
import { hybridFoodSearch } from '@/app/coach/food-cache/actions';
import { EnrichedFood, MealItem, SavedMeal, NovaGroup } from '@/types/nutrition';
import { SearchResult } from '@/types/index';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

// Helper to map string rating to NovaGroup enum
const toNovaGroup = (rating: string): NovaGroup => {
    switch (rating) {
        case 'whole_food': return NovaGroup.WHOLE_FOOD;
        case 'processed': return NovaGroup.PROCESSED;
        case 'ultra_processed': return NovaGroup.UPF;
        default: return NovaGroup.UNCLASSIFIED;
    }
};

// Create a robust, recursive timestamp converter.
const convertTimestamps = (data: any): any => {
  if (!data) return data;
  if (data instanceof Timestamp) {
    return data.toDate().toISOString(); 
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  if (typeof data === 'object' && data !== null) {
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value && Object.keys(value).length === 2) {
             newObj[key] = new Timestamp(value.seconds, value.nanoseconds).toDate().toISOString();
        } else {
             newObj[key] = convertTimestamps(value);
        }
      }
    }
    return newObj;
  }
  return data;
};

export async function analyzeAndCacheFood(fdcId: number): Promise<EnrichedFood | null> {
  console.log(`[Action] analyzeAndCacheFood for fdcId: ${fdcId}`);
  const foodCacheRef = adminDb.collection('global-food-cache').doc(String(fdcId));

  try {
    const cachedDoc = await foodCacheRef.get();
    if (cachedDoc.exists) {
      console.log(`[Action] Cache HIT for fdcId: ${fdcId}`);
      return convertTimestamps(cachedDoc.data()) as EnrichedFood;
    }

    console.log(`[Action] Cache MISS for fdcId: ${fdcId}. Enriching...`);

    const detailsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/food/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fdcId }),
    });

    if (!detailsResponse.ok) {
      const errorBody = await detailsResponse.text();
      console.error(`[Action] API call to fetch food details failed with status ${detailsResponse.status}:`, errorBody);
      throw new Error(`Failed to fetch details for fdcId: ${fdcId}. Status: ${detailsResponse.status}`);
    }

    const foodDetails = await detailsResponse.json();

    if (!foodDetails) {
      throw new Error(`Failed to parse details for fdcId: ${fdcId}`);
    }

    const settings = await getSiteSettingsAction();
    const modelName = settings.data?.aiModelSettings?.flash;

    if (!modelName) {
        throw new Error('Flash AI model not configured in site settings.');
    }

    const aiInput = {
        description: foodDetails.description,
        ingredients: foodDetails.ingredients,
        modelName: modelName,
    };

    const flowApiUrl = new URL('/api/flows/enrichFoodDetailsFlow', process.env.NEXT_PUBLIC_APP_URL);
    const response = await fetch(flowApiUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: aiInput }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Action CRITICAL] API call to enrichFoodDetailsFlow failed.', { status: response.status, error: errorText });
        throw new Error(`AI analysis API call failed with status ${response.status}`);
    }

    const analysisOutput = await response.json();

    if (!analysisOutput) {
      throw new Error('AI analysis failed: The flow did not return a result object.');
    }

    const enrichedFood: EnrichedFood = {
      ...foodDetails,
      source: 'AI_ANALYSIS',
      analysisDate: new Date().toISOString(),
      upfAnalysis: {
        rating: toNovaGroup(analysisOutput.upfAnalysis.rating),
        justification: analysisOutput.upfAnalysis.justification,
      },
      glutenAnalysis: analysisOutput.glutenAnalysis ? {
        isGlutenFree: analysisOutput.glutenAnalysis.isGlutenFree,
        justification: analysisOutput.glutenAnalysis.justification,
      } : undefined,
      portionSizes: analysisOutput.portionSizes,
      upfPercentage: {
        value: analysisOutput.upfPercentage.value,
        justification: analysisOutput.upfPercentage.justification,
      },
      fdcId: fdcId
    };

    await foodCacheRef.set(enrichedFood);
    console.log(`[Action] Successfully enriched and cached fdcId: ${fdcId}`);

    return convertTimestamps(enrichedFood);

  } catch (error) {
    console.error(`[Action CRITICAL] analyzeAndCacheFood for fdcId ${fdcId} failed:`, error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('An unknown error occurred during server-side analysis.');
  }
}

export async function getFoodSearchResults({ query }: { query: string; }): Promise<SearchResult[]> {
    if (!query) return [];
    try {
        const results = await hybridFoodSearch(query);
        // FIX: Cast results to any to bypass the missing 'source' property error 
        // while the hybridFoodSearch return type is being synchronized.
        return (results as any[]).map(food => ({
            fdcId: food.fdcId,
            description: food.description,
            brandOwner: food.brandOwner,
            source: food.source || 'USDA', 
            isCached: food.isCached ?? false, 
        }));
    } catch (error) {
        console.error(`[Action CRITICAL] getFoodSearchResults for query '${query}' failed:`, error);
        return [];
    }
}

export async function getEnrichedFoodsByFdcIds(fdcIds: number[]): Promise<EnrichedFood[]> {
    if (fdcIds.length === 0) return [];
    try {
        const foodMap = new Map<number, EnrichedFood>();
        const stringIds = fdcIds.map(id => String(id));
        
        const chunkSize = 30; 
        for (let i = 0; i < stringIds.length; i += chunkSize) {
            const chunk = stringIds.slice(i, i + chunkSize);
            if(chunk.length > 0) {
                const foodDocs = await adminDb.collection('global-food-cache').where(FieldPath.documentId(), 'in', chunk).get();
                foodDocs.forEach(doc => {
                    const food = doc.data() as EnrichedFood;
                    foodMap.set(food.fdcId, convertTimestamps(food));
                });
            }
        }

        return fdcIds.map(id => foodMap.get(id)).filter((f): f is EnrichedFood => !!f);
    } catch (error) {
        console.error('[Action CRITICAL] getEnrichedFoodsByFdcIds failed:', error);
        return [];
    }
}

export async function toggleFavoriteFood(userId: string, fdcId: number, isFavorite: boolean): Promise<{ success: boolean }> {
  const favoriteDocRef = adminDb.collection('clients').doc(userId).collection('userFavoriteFoods').doc(String(fdcId));
  try {
    if (isFavorite) {
      const enrichedFood = await analyzeAndCacheFood(fdcId);
      if (!enrichedFood || !enrichedFood.description) {
        console.error(`[Action VALIDATION] toggleFavoriteFood failed for user ${userId}. Food ${fdcId} could not be enriched or is missing a description.`);
        return { success: false };
      }
      await favoriteDocRef.set({ fdcId: fdcId, addedAt: new Date() });
    } else {
      await favoriteDocRef.delete();
    }
    return { success: true };
  } catch (error) {
    console.error(`[Action CRITICAL] toggleFavoriteFood for user ${userId} failed:`, error);
    return { success: false };
  }
}

export async function getFavoriteFoods(userId: string): Promise<EnrichedFood[]> {
  try {
    const favoritesSnapshot = await adminDb.collection('clients').doc(userId).collection('userFavoriteFoods').get();
    if (favoritesSnapshot.empty) return [];

    const fdcIds = favoritesSnapshot.docs.map(doc => parseInt(doc.id, 10));
    return await getEnrichedFoodsByFdcIds(fdcIds);
  } catch (error) {
    console.error(`[Action CRITICAL] getFavoriteFoods for user ${userId} failed:`, error);
    return [];
  }
}

export async function saveUserMeal(userId: string, mealName: string, mealItems: MealItem[]): Promise<{ success: boolean; mealId?: string }> {
  const fdcIds = mealItems.map(item => item.fdcId);
  const enrichedFoods = await getEnrichedFoodsByFdcIds(fdcIds);
  const foodMap = new Map(enrichedFoods.map(f => [f.fdcId, f]));

  if (enrichedFoods.length !== fdcIds.length) {
      console.warn(`[Action VALIDATION] saveUserMeal for user ${userId}. Not all fdcIds could be enriched. Found ${enrichedFoods.length} of ${fdcIds.length}.`);
  }

  const itemsToSave: MealItem[] = mealItems.map(item => {
    const enrichedFood = foodMap.get(item.fdcId);
    return {
      ...item,
      description: enrichedFood?.description || item.description || 'Unknown Food',
    };
  });

  const savedMeal = {
    uid: userId,
    name: mealName,
    items: itemsToSave, 
    createdAt: new Date(),
    totalCalories: itemsToSave.reduce((acc, item) => acc + (item.calories || 0), 0),
  };

  try {
    const savedMealRef = await adminDb.collection('clients').doc(userId).collection('userSavedMeals').add(savedMeal);
    return { success: true, mealId: savedMealRef.id };
  } catch (error) {
    console.error(`[Action CRITICAL] saveUserMeal for user ${userId} failed:`, error);
    return { success: false };
  }
}

export async function deleteUserMeal(userId: string, mealId: string): Promise<{ success: boolean }> {
  const mealDocRef = adminDb.collection('clients').doc(userId).collection('userSavedMeals').doc(mealId);
  try {
    await mealDocRef.delete();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getSavedMeals(userId: string): Promise<SavedMeal[]> {
  try {
    const mealsSnapshot = await adminDb
        .collection('clients').doc(userId)
        .collection('userSavedMeals').orderBy('createdAt', 'desc').get();

    if (mealsSnapshot.empty) return [];

    const meals: SavedMeal[] = mealsSnapshot.docs.map(doc => {
        const data = doc.data();
        return convertTimestamps({
            id: doc.id,
            uid: data.uid || userId,
            name: data.name || 'Unnamed Meal',
            items: data.items || [],
            createdAt: data.createdAt,
            totalCalories: data.totalCalories || 0,
        }) as SavedMeal;
    });

    const fdcIds = [...new Set(meals.flatMap(m => m.items.map(i => i.fdcId)))];
    if (fdcIds.length === 0) {
        return meals;
    }

    const enrichedFoods = await getEnrichedFoodsByFdcIds(fdcIds);
    const foodMap = new Map(enrichedFoods.map(f => [f.fdcId, f]));

    const enrichedMeals = meals.map(meal => ({
        ...meal,
        items: meal.items
            .map(item => ({
                ...item,
                enrichedFood: foodMap.get(item.fdcId)
            }))
            // FIX: Changed 'Fitem' to 'item' to resolve TS2552
            .filter(item => item.enrichedFood)
    }));

    return enrichedMeals as any;

} catch (error) {
    console.error(`[Action CRITICAL] getSavedMeals for user ${userId} failed:`, error);
    return [];
}
}