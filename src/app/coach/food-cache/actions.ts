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
  PortionSizesSchema,
  HybridFoodSearchResult
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

async function searchUSDA(query: string): Promise<z.infer<typeof FoodSearchResultSchema>> {
  const USDA_API_KEY = process.env.USDA_API_KEY;
  if (!USDA_API_KEY) {
    console.error("[Food Cache] CRITICAL: USDA_API_KEY is not configured in environment variables. Search will not work.");
    return []; 
  }
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=150&dataType=Branded,SR%20Legacy,Foundation`;
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
    return [];
  }
}

export async function hybridFoodSearch(query: string, scope: 'all' | 'cached' | 'usda' = 'all'): Promise<HybridFoodSearchResult[]> {
    if (query.length < 2) return [];
    
    const lowercasedQuery = query.toLowerCase();
    const resultsMap = new Map<number, HybridFoodSearchResult>();

    // Promise placeholders
    let usdaPromise: Promise<any[]> = Promise.resolve([]);
    let localPromise: Promise<any> = Promise.resolve({ docs: [] });

    if (scope === 'all' || scope === 'usda') {
        usdaPromise = searchUSDA(query);
    }
    if (scope === 'all' || scope === 'cached') {
        localPromise = adminDb.collection('global-food-cache')
            .where('searchableDescription', '>=', lowercasedQuery)
            .where('searchableDescription', '<=', lowercasedQuery + '\uf8ff')
            .limit(150) // Increased limit for filtered searches
            .get();
    }

    const [usdaResults, localSnapshot] = await Promise.all([usdaPromise, localPromise]);

    // Process local results first to give them priority
    localSnapshot.docs.forEach((doc: any) => {
        const food = doc.data() as EnrichedFood;
        resultsMap.set(food.fdcId, {
            fdcId: food.fdcId,
            description: food.description,
            brandOwner: food.brandOwner || '',
            isCached: true,
        });
    });

    // Process USDA results, respecting the scope and avoiding duplicates
    if (scope !== 'cached' && usdaResults.length > 0) {
        const usdaFdcIds = usdaResults.map(f => f.fdcId).filter(id => !resultsMap.has(id));
        
        if (usdaFdcIds.length > 0) {
            // Check which of the USDA results are already in our cache
            const cachedIds = await checkCachedStatus(usdaFdcIds);
            const cachedIdsSet = new Set(cachedIds);

            usdaResults.forEach(food => {
                if (!resultsMap.has(food.fdcId)) {
                     resultsMap.set(food.fdcId, {
                        fdcId: food.fdcId,
                        description: food.description,
                        brandOwner: food.brandOwner || '',
                        isCached: cachedIdsSet.has(food.fdcId),
                    });
                }
            });
        }
    }

    // If scope is 'usda' only, filter out any cached items that might have slipped in
    const finalResults = Array.from(resultsMap.values()).filter(result => {
        if (scope === 'cached') return result.isCached;
        // A check to ensure only non-cached items appear in USDA search.
        if (scope === 'usda') {
            const correspondingUsdaResult = usdaResults.find(u => u.fdcId === result.fdcId);
            return correspondingUsdaResult && !result.isCached;
        }
        return true;
    });

    return finalResults.sort((a, b) => a.description.localeCompare(b.description));
}

export async function getFoodDetails(fdcId: number) {
    const USDA_API_KEY = process.env.USDA_API_KEY;
    if (!USDA_API_KEY) {
        throw new Error("USDA API Key is not configured.");
    }
    const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${USDA_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data: BrandedFoodItem = await response.json();

        const keyNutrientIds = { Calories: 1008, Protein: 1003, Fat: 1004, Carbs: 1005, Fiber: 1079 };
        const nutrientMap: Map<number, Nutrient> = new Map();
        data.foodNutrients.forEach(n => {
            const amount = n.amount ?? 0;
            nutrientMap.set(n.nutrient.id, { id: n.nutrient.id, name: n.nutrient.name, amount: amount, unitName: n.nutrient.unitName.toLowerCase() });
        });

        const atwaterEnergy = data.foodNutrients.find(n => n.nutrient.id === 2047);
        if (atwaterEnergy) {
             nutrientMap.set(keyNutrientIds.Calories, { id: keyNutrientIds.Calories, name: 'Energy', amount: atwaterEnergy.amount ?? 0, unitName: 'kcal' });
        } else if (!nutrientMap.has(keyNutrientIds.Calories)) {
            nutrientMap.set(keyNutrientIds.Calories, { id: keyNutrientIds.Calories, name: 'Energy', amount: 0, unitName: 'kcal' });
        }

        const finalNutrients: Nutrient[] = [];
        const nutrientDefinitions: { [key: number]: { name: string; unit: string } } = {
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
                finalNutrients.push({ id: numId, name: (nutrientDefinitions as any)[id].name, amount: 0, unitName: (nutrientDefinitions as any)[id].unit });
            }
        }
        
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
  if (fdcIds.length === 0) return [];
  const foodCacheRef = adminDb.collection('global-food-cache');
  const cachedIds: number[] = [];
  const CHUNK_SIZE = 30; 
  for (let i = 0; i < fdcIds.length; i += CHUNK_SIZE) {
    const chunk = fdcIds.slice(i, i + CHUNK_SIZE);
    const snapshot = await foodCacheRef.where('fdcId', 'in', chunk).get();
    snapshot.forEach(doc => { cachedIds.push(doc.data().fdcId); });
  }
  return cachedIds;
}


export async function getEnrichedFood(fdcId: number): Promise<EnrichedFood | null> {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
    const docSnap = await foodDocRef.get();
    if (!docSnap.exists) return null;
    return convertTimestampsToISO(docSnap.data()) as EnrichedFood;
}

export async function getEnrichedFoodsForExport(fdcIds: number[]): Promise<EnrichedFood[]> {
    if (fdcIds.length === 0) return [];

    const foodCacheRef = adminDb.collection('global-food-cache');
    const enrichedFoods: EnrichedFood[] = [];
    const CHUNK_SIZE = 30; // Firestore 'in' query supports up to 30 elements

    for (let i = 0; i < fdcIds.length; i += CHUNK_SIZE) {
        const chunk = fdcIds.slice(i, i + CHUNK_SIZE);
        const snapshot = await foodCacheRef.where('fdcId', 'in', chunk).get();
        snapshot.forEach(doc => {
            enrichedFoods.push(convertTimestampsToISO(doc.data()) as EnrichedFood);
        });
    }

    return enrichedFoods;
}

export async function getOrEnrichFoodForUser(fdcId: number): Promise<EnrichedFood | null> {
  const cachedFood = await getEnrichedFood(fdcId);
  if (cachedFood) return cachedFood;

  const foodDetails = await getFoodDetails(fdcId);
  if (!foodDetails) return null;

  const aiInput = { description: foodDetails.description, ingredients: foodDetails.ingredients || '' };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");

  let enrichedDetailsFromAI: any;
  try {
    const response = await fetch(`${appUrl}/api/flows/enrichFoodDetailsFlow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: aiInput }),
    });
    if (!response.ok) throw new Error(`AI flow failed with status ${response.status}`);
    enrichedDetailsFromAI = await response.json();
  } catch (error) {
    console.error('Calling the AI enrichment flow failed.', error);
    enrichedDetailsFromAI = { result: {} };
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
    ...(foodDetails as any),
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
        searchableDescription: newEnrichedFood.description.toLowerCase(),
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
            searchableDescription: foodData.description.toLowerCase(),
            analysisDate: Timestamp.fromDate(foodData.analysisDate && !isNaN(new Date(foodData.analysisDate).getTime()) ? new Date(foodData.analysisDate) : new Date()),
            updatedAt: FieldValue.serverTimestamp(),
        };
        const docSnap = await foodDocRef.get();
        if (docSnap.exists) {
            await foodDocRef.update(dataToSave);
        } else {
          dataToSave.createdAt = FieldValue.serverTimestamp();
            await foodDocRef.set(dataToSave, { merge: true });
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

export async function generateNewFdcId(): Promise<number> {
    const foodCacheRef = adminDb.collection('global-food-cache');
    const snapshot = await foodCacheRef.orderBy('fdcId', 'asc').where('fdcId', '<', 0).limit(1).get();
    if (snapshot.empty) return -1;
    const lowestFdcId = snapshot.docs[0].data().fdcId;
    return lowestFdcId - 1;
}


const CSV_HEADERS = [
    'fdcId', 'description', 'brandName', 'calories', 'protein', 'fat', 
    'carbs', 'sugar', 'fiber', 'servingSizes', 'upfPercentage', 
    'novaGroup', 'isGlutenFree', 'ingredients'
];

const parseCsvRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of row) {
        if (char === '"' && inQuotes) {
            inQuotes = false;
        } else if (char === '"' && !inQuotes) {
            inQuotes = true;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
};

const getNovaGroupFromString = (rating: string): NovaGroup => {
    const lowercasedRating = rating.toLowerCase();
    const novaGroupMap: { [key: string]: NovaGroup } = {
        'whole_food': NovaGroup.WHOLE_FOOD,
        'processed': NovaGroup.PROCESSED,
        'upf': NovaGroup.UPF,
    };
    return novaGroupMap[lowercasedRating] || NovaGroup.UNCLASSIFIED;
}

export async function bulkSaveFoodsToCache(formData: FormData): Promise<{ success: boolean; error?: string; details?: { total: number, created: number, updated: number } }> {
    const file = formData.get('file') as File;
    if (!file) return { success: false, error: 'No file uploaded.' };

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return { success: false, error: 'File size exceeds 5MB limit.' };
    }

    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { success: false, error: 'CSV file must contain a header and at least one data row.' };

    const header = lines[0].split(',').map(h => h.trim());
    if (JSON.stringify(header) !== JSON.stringify(CSV_HEADERS)) {
        return { success: false, error: `Invalid CSV headers. Expected: ${CSV_HEADERS.join(',')}` };
    }

    const headerMap = header.reduce((acc, curr, i) => ({ ...acc, [curr]: i }), {} as { [key: string]: number });
    const dataRows = lines.slice(1);
    
    let createdCount = 0;
    let updatedCount = 0;

    const BATCH_SIZE = 400;
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = dataRows.slice(i, i + BATCH_SIZE);

        for (const row of chunk) {
            if (!row.trim()) continue; // Skip empty lines
            const values = parseCsvRow(row);

            try {
                const fdcIdStr = values[headerMap.fdcId];
                let fdcId = fdcIdStr ? parseInt(fdcIdStr, 10) : NaN;

                if (isNaN(fdcId)) {
                    fdcId = await generateNewFdcId();
                    createdCount++;
                } else {
                    updatedCount++;
                }
                
                const nutrients: Nutrient[] = [
                    { id: 1008, name: 'Energy', amount: parseFloat(values[headerMap.calories]) || 0, unitName: 'kcal' },
                    { id: 1003, name: 'Protein', amount: parseFloat(values[headerMap.protein]) || 0, unitName: 'g' },
                    { id: 1004, name: 'Total lipid (fat)', amount: parseFloat(values[headerMap.fat]) || 0, unitName: 'g' },
                    { id: 1005, name: 'Carbohydrate, by difference', amount: parseFloat(values[headerMap.carbs]) || 0, unitName: 'g' },
                    { id: 2000, name: 'Sugars, total including NLEA', amount: parseFloat(values[headerMap.sugar]) || 0, unitName: 'g' },
                    { id: 1079, name: 'Fiber, total dietary', amount: parseFloat(values[headerMap.fiber]) || 0, unitName: 'g' },
                ];

                const portionSizes: PortionSize[] = values[headerMap.servingSizes]?.split('|').map(p => {
                    const [description, gramWeight] = p.split(':');
                    return { description: description?.trim() || '', gramWeight: parseFloat(gramWeight) || 0 };
                }).filter(p => p.description && p.gramWeight > 0) || [];

                const upfAnalysis: UpfAnalysis = {
                    rating: getNovaGroupFromString(values[headerMap.novaGroup] || ''),
                    justification: 'Manually entered during bulk import.',
                };

                const isGlutenFree = (values[headerMap.isGlutenFree]?.toLowerCase() === 'true');
                const glutenAnalysis: GlutenAnalysis = {
                    isGlutenFree,
                    justification: 'Manually entered during bulk import.',
                };

                const foodData: Omit<EnrichedFood, 'analysisDate' | 'source'> & { fdcId: number } = {
                    fdcId,
                    description: values[headerMap.description] || '',
                    brandOwner: values[headerMap.brandName] || '',
                    ingredients: values[headerMap.ingredients] || '',
                    nutrients,
                    portionSizes,
                    upfPercentage: { 
                        value: parseInt(values[headerMap.upfPercentage], 10) || 0, 
                        justification: 'Manually entered during bulk import.' 
                    },
                    upfAnalysis,
                    glutenAnalysis,
                };

                const docRef = adminDb.collection('global-food-cache').doc(String(fdcId));
                const dataToSave = {
                    ...foodData,
                    source: 'MANUAL_BULK',
                    searchableDescription: foodData.description.toLowerCase(),
                    analysisDate: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                batch.set(docRef, dataToSave, { merge: true });

            } catch (e: any) {
                console.warn(`[Food Cache Bulk] Skipping row due to error: ${row}. Error: ${e.message}`);
                continue; // Skip rows that have parsing errors
            }
        }
        await batch.commit();
    }

    return {
        success: true,
        details: { total: dataRows.length, created: createdCount, updated: updatedCount },
    };
}
