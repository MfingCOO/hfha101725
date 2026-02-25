'use server';

import { db as adminDb, auth } from '@/lib/firebaseAdmin';
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
} from '@/types/nutrition';
import { HybridFoodSearchResult } from '@/types/index';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { algoliaAdmin } from '@/lib/algoliaAdmin';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';


const parsePortionSizes = (value: any): PortionSize[] => {
    if (Array.isArray(value)) {
        try {
            return PortionSizesSchema.parse(value);
        } catch (e) {
            console.warn("An array was passed to parsePortionSizes that did not match the schema.", value);
            return [];
        }
    }

    if (typeof value === 'string') {
        return value.split('|').map((part: string): PortionSize | null => {
            const trimmedPart = part.trim();
            if (!trimmedPart) return null;
            
            const lastColonIndex = trimmedPart.lastIndexOf(':');
            
            if (lastColonIndex > 0 && lastColonIndex < trimmedPart.length - 1) {
                const description = trimmedPart.substring(0, lastColonIndex).trim();
                const weightStr = trimmedPart.substring(lastColonIndex + 1).trim();
                const gramWeight = parseFloat(weightStr);

                if (description && !isNaN(gramWeight)) {
                    return { description, gramWeight };
                }
            }
            return null;
        }).filter((p): p is PortionSize => p !== null);
    }

    return [];
};

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
async function searchAlgolia(query: string): Promise<HybridFoodSearchResult[]> {
    try {
        const { results } = await algoliaAdmin.search([
            {
                indexName: 'food_cache',
                params: {
                  query: query,
                  hitsPerPage: 150,
                },
              }          
          ]);
          
          const hits = (results[0] as any)?.hits || [];    
      return hits.map((hit: any) => ({
        fdcId: hit.fdcId,
        description: hit.description,
        brandOwner: hit.brandOwner || '',
        isCached: true,
      }));
    } catch (error) {
      console.error('[Algolia Search] Failed to search:', error);
      return [];
    }
  }
  
export async function hybridFoodSearch(query: string, scope: 'all' | 'cached' | 'usda' = 'all'): Promise<HybridFoodSearchResult[]> {
    if (query.length < 2) return [];
    
    const lowercasedQuery = query.toLowerCase();
    const resultsMap = new Map<number, HybridFoodSearchResult>();

    let usdaPromise: Promise<any[]> = Promise.resolve([]);
    let algoliaPromise: Promise<HybridFoodSearchResult[]> = Promise.resolve([]);

    if (scope === 'all' || scope === 'usda') {
        usdaPromise = searchUSDA(query);
    }
    if (scope === 'all' || scope === 'cached') { 
        algoliaPromise = searchAlgolia(query);
    }
    
    const [usdaResults, algoliaResults] = await Promise.all([usdaPromise, algoliaPromise]);

    algoliaResults.forEach((food: HybridFoodSearchResult) => {
        resultsMap.set(food.fdcId, {
            fdcId: food.fdcId,
            description: food.description,
            brandOwner: food.brandOwner || '',
            isCached: true,
        });
    });
   
    if (scope !== 'cached' && usdaResults.length > 0) {
        const usdaFdcIds = usdaResults.map(f => f.fdcId).filter(id => !resultsMap.has(id));
        
        if (usdaFdcIds.length > 0) {
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

    const finalResults = Array.from(resultsMap.values()).filter(result => {
        if (scope === 'cached') return result.isCached;
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
    try {
        if (fdcIds.length === 0) return [];
        const foodCacheRef = adminDb.collection('global-food-cache');
        const enrichedFoods: EnrichedFood[] = [];
        const CHUNK_SIZE = 30;
        for (let i = 0; i < fdcIds.length; i += CHUNK_SIZE) {
            const chunk = fdcIds.slice(i, i + CHUNK_SIZE);
            const snapshot = await foodCacheRef.where('fdcId', 'in', chunk).get();
            snapshot.forEach(doc => {
                enrichedFoods.push(convertTimestampsToISO(doc.data()) as EnrichedFood);
            });
        }
        return enrichedFoods;
    } catch (error) {
        console.error("[Server Action] Failed to fetch foods for CSV export:", error);
        throw new Error("Failed to fetch enriched foods for export.");
    }
}

export async function getDetailsForCsvExport(foodItems: HybridFoodSearchResult[]): Promise<EnrichedFood[]> {
    try {
        if (!foodItems || foodItems.length === 0) return [];

        const cachedFdcIds = foodItems.filter(r => r.isCached).map(r => r.fdcId);
        const nonCachedFdcIds = foodItems.filter(r => !r.isCached).map(r => r.fdcId);

        const cachedFoodsPromise = getEnrichedFoodsForExport(cachedFdcIds);
        
        const nonCachedFoodsPromise = Promise.all(
            nonCachedFdcIds.map(async (id) => {
                try {
                    const details = await getFoodDetails(id);
                    if (!details) {
                        return null; // If we can't get basic details, skip it.
                    }

                    // Manually construct a complete EnrichedFood object with default values
                    const completeFood: EnrichedFood = {
                        fdcId: details.fdcId,
                        description: details.description,
                        brandOwner: details.brandOwner,
                        ingredients: details.ingredients,
                        nutrients: details.nutrients,
                        source: 'USER_PROVIDED', // CORRECTED: Was 'USDA'
                        analysisDate: new Date().toISOString(), // Use current date as a placeholder
                        upfAnalysis: {
                            rating: NovaGroup.UNCLASSIFIED,
                            justification: 'Not analyzed.'
                        },
                        upfPercentage: {
                            value: 0,
                            justification: 'Not analyzed.'
                        },
                        glutenAnalysis: {
                            isGlutenFree: false,
                            justification: 'Not analyzed.'
                        },
                        portionSizes: [], // Default to an empty array
                    };
                    return completeFood;

                } catch (e) {
                    console.error(`Error fetching and processing details for FDC ID ${id}:`, e);
                    return null; // Return null on error for this specific item
                }
            })
        );

        const [cachedFoods, nonCachedFoodsWithNulls] = await Promise.all([cachedFoodsPromise, nonCachedFoodsPromise]);
        
        // Filter out any nulls from the non-cached results
        const nonCachedFoods = nonCachedFoodsWithNulls.filter((food): food is EnrichedFood => food !== null);
        
        return [...cachedFoods, ...nonCachedFoods];

    } catch (error) {
        console.error("[Server Action] Failed to orchestrate CSV data preparation:", error);
        throw new Error("Failed to prepare data for CSV export.");
    }
}


export async function getOrEnrichFoodForUser(fdcId: number): Promise<EnrichedFood | null> {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
    const docSnap = await foodDocRef.get();

    if (docSnap.exists) {
        return convertTimestampsToISO(docSnap.data()) as EnrichedFood;
    }

    const foodDetails = await getFoodDetails(fdcId);
    if (!foodDetails) return null;

    // Get the model name from site settings
    const settings = await getSiteSettingsAction();
    const modelNameFromDb = settings.data?.aiModelSettings?.pro;

    if (!modelNameFromDb) {
        console.error('[Server Action CRITICAL] Pro AI model not configured in site settings. Cannot enrich food.');
        return null;
    }
    const modelName = `googleai/${modelNameFromDb}`;

    // Prepare the input for the AI flow, now including the required modelName
    const aiInput = {
        description: foodDetails.description,
        ingredients: foodDetails.ingredients || '',
        modelName: modelName
    };

    let aiResult: any;
    try {
        // Call the server action directly for a stable, secure execution
        aiResult = await enrichFoodDetailsFlow(aiInput);
    } catch (error) {
        console.error('[CRITICAL] Direct call to enrichFoodDetailsFlow failed.', error);
        return null;
    }

    if (!aiResult) {
        console.error('AI Result was empty or malformed after direct flow execution.');
        return null;
    }

    const newEnrichedFood: EnrichedFood = {
        ...(foodDetails as any),
        source: 'AI_ANALYSIS',
        analysisDate: new Date().toISOString(),
        upfAnalysis: UpfAnalysisSchema.parse(aiResult.upfAnalysis),
        upfPercentage: UpfPercentageSchema.parse(aiResult.upfPercentage),
        glutenAnalysis: GlutenAnalysisSchema.parse(aiResult.glutenAnalysis),
        portionSizes: PortionSizesSchema.parse(aiResult.portionSizes),
    };

    // Save the new object to Firestore and Algolia
    try {
        const { createdAt, updatedAt, ...restOfData } = newEnrichedFood;
        const dataToSave: any = {
            ...restOfData,
            searchableDescription: newEnrichedFood.description.toLowerCase(),
            analysisDate: Timestamp.fromDate(new Date(newEnrichedFood.analysisDate)),
            updatedAt: FieldValue.serverTimestamp(),
        };
        
        dataToSave.createdAt = docSnap.exists ? docSnap.data()?.createdAt : FieldValue.serverTimestamp();
        await foodDocRef.set(dataToSave, { merge: true });

        try {
            await algoliaAdmin.saveObjects({ indexName: 'food_cache', objects: [{ objectID: String(fdcId), ...newEnrichedFood }] });
        } catch (algoliaError) {
            console.error(`[Algolia Sync] Failed to sync fdcId ${fdcId} after enrichment.`, algoliaError);
        }

    } catch (error) {
        console.error("CRITICAL: Failed to save AI-enriched food to Firestore:", error);
        return null;
    }

    return convertTimestampsToISO(newEnrichedFood);
}


export async function saveManualEnrichedFood(foodData: EnrichedFood, idToken: string): Promise<{ success: boolean; error?: string; food?: EnrichedFood; }> {
    if (!idToken) {
        return { success: false, error: 'Authentication token not provided.' };
    }
    
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch (error: any) {
        console.error("[Auth] Error verifying token in saveManualEnrichedFood:", error);
        return { success: false, error: 'Your session is invalid. Please log in again.' };
    }
    

    // 2. Prepare the data for Firestore
    const { uid: userId, isCoach } = decodedToken;
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(foodData.fdcId));

    try {
        const { createdAt, updatedAt, ...restOfFoodData } = foodData;
        const docSnap = await foodDocRef.get();

        // This object will be merged into the document.
        const dataToSave: any = {
            ...restOfFoodData, // The bulk of the food data from the form
            searchableDescription: foodData.description.toLowerCase(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Convert ISO string date from client to Firestore Timestamp
        if (foodData.analysisDate && !isNaN(new Date(foodData.analysisDate).getTime())) {
            dataToSave.analysisDate = Timestamp.fromDate(new Date(foodData.analysisDate));
        } else {
            dataToSave.analysisDate = FieldValue.serverTimestamp();
        }

        // 3. Apply business logic based on create vs. update
        if (docSnap.exists) {
            // This is an UPDATE
            const existingData = docSnap.data();
            // If a coach is editing a food submitted by a user, it's now "approved"
            if (isCoach && existingData?.source === 'USER_PROVIDED') {
                dataToSave.source = 'MANUAL_BULK';
            }
            // We don't overwrite the original creator or creation date
        } else {
            // This is a CREATE
            dataToSave.createdAt = FieldValue.serverTimestamp();
            dataToSave.createdBy = userId;
            // When creating, the source is determined by the user's role
            dataToSave.source = isCoach ? 'MANUAL_BULK' : 'USER_PROVIDED';
        }

        // 4. Save to Firestore
        await foodDocRef.set(dataToSave, { merge: true });
// After saving, fetch the complete document to get server-generated timestamps
const finalDoc = await foodDocRef.get();
const finalData = finalDoc.data();

if (!finalData) {
     throw new Error("Failed to retrieve saved food data from Firestore.");
}

const finalFoodObject = convertTimestampsToISO(finalData) as EnrichedFood;

        // 5. Sync with Algolia
try {
    await algoliaAdmin.saveObjects({ indexName: 'food_cache', objects: [{ objectID: String(foodData.fdcId), ...finalFoodObject }] });
} catch (algoliaError) {
    console.error(`[Algolia Sync] Failed to sync fdcId ${foodData.fdcId} after manual save.`, algoliaError);
    // We don't fail the whole operation for this, just log it.
}
      // This line has been removed to fix the saving functionality.
        return { success: true, food: finalFoodObject };
    } catch (dbError) {
        console.error("CRITICAL ERROR: Failed to save to Firestore:", dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : 'An unknown database error occurred.';
        return { success: false, error: errorMessage };
    }
}


export async function deleteFoodFromCache(fdcId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const foodDocRef = adminDb.collection('global-food-cache').doc(String(fdcId));
        await foodDocRef.delete();

        try {
            await algoliaAdmin.deleteObjects({ indexName: 'food_cache', objectIDs: [String(fdcId)] });
        } catch (algoliaError) {
            console.error(`[Algolia Sync] Failed to delete fdcId ${fdcId}. The record may need to be removed manually.`, algoliaError);
        }

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

    if (file.size > 5 * 1024 * 1024) {
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
    const allFoodsToSync: any[] = [];

    const BATCH_SIZE = 400;
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batch = adminDb.batch();
        const chunk = dataRows.slice(i, i + BATCH_SIZE);

        for (const row of chunk) {
            if (!row.trim()) continue;
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

                const portionSizes = parsePortionSizes(values[headerMap.servingSizes]);

                const upfAnalysis: UpfAnalysis = {
                    rating: getNovaGroupFromString(values[headerMap.novaGroup] || ''),
                    justification: 'Manually entered during bulk import.',
                };

                const isGlutenFree = (values[headerMap.isGlutenFree]?.toLowerCase() === 'true');
                const glutenAnalysis: GlutenAnalysis = { isGlutenFree, justification: 'Manually entered during bulk import.' };

                const foodData: Omit<EnrichedFood, 'analysisDate' | 'source'> & { fdcId: number } = {
                    fdcId,
                    description: values[headerMap.description] || '',
                    brandOwner: values[headerMap.brandName] || '',
                    ingredients: values[headerMap.ingredients] || '',
                    nutrients,
                    portionSizes,
                    upfPercentage: { value: parseInt(values[headerMap.upfPercentage], 10) || 0, justification: 'Manually entered during bulk import.' },
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
                allFoodsToSync.push({ objectID: String(fdcId), ...foodData });

            } catch (e: any) {
                console.warn(`[Food Cache Bulk] Skipping row due to error: ${row}. Error: ${e.message}`);
                continue;
            }
        }
        await batch.commit();
    }

    if (allFoodsToSync.length > 0) {
        try {
            await algoliaAdmin.saveObjects({ indexName: 'food_cache', objects: allFoodsToSync });
           console.log(`[Algolia Sync] Successfully synced ${allFoodsToSync.length} items from CSV import.`);
        } catch (error) {
            console.error('[Algolia Sync] CRITICAL: Failed to bulk sync after CSV import:', error);
        }
    }

    return {
        success: true,
        details: { total: dataRows.length, created: createdCount, updated: updatedCount },
    };
}

export async function getUnreviewedUserFoods(): Promise<EnrichedFood[]> {
    try {
        const snapshot = await adminDb.collection('global-food-cache')
            .where('source', '==', 'USER_PROVIDED')
            // .orderBy('createdAt', 'desc') // This query requires a composite index. Sorting in-memory instead.
            .get();

        if (snapshot.empty) {
            return [];
        }

        const foods = snapshot.docs.map(doc => convertTimestampsToISO(doc.data()) as EnrichedFood);
        // Manually sort by creation date descending, as we can't use the composite index
foods.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
});
        return foods;
    } catch (error) {
        console.error("[Server Action] Failed to fetch unreviewed user foods:", error);
        throw new Error("Failed to fetch unreviewed foods.");
    }
}

export async function getUnreviewedUserFoodCount(): Promise<number> {
    try {
        const snapshot = await adminDb.collection('global-food-cache')
            .where('source', '==', 'USER_PROVIDED')
            .count()
            .get();
        return snapshot.data().count;
    } catch (error) {
        console.error("[Server Action] Failed to fetch unreviewed user food count:", error);
        return 0; // Return 0 on error
    }
}
