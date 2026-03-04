'use server';

import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';
import { db as adminDb } from '@/lib/firebaseAdmin'; 
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

/**
 * PRIVATE HELPER: Fetches deep data from USDA API
 * This bridges the gap between a "Light Search" and "AI Enrichment"
 */
async function fetchUsdaDetails(fdcId: string | number) {
  const API_KEY = process.env.USDA_API_KEY;
  if (!API_KEY) throw new Error("USDA_API_KEY is not configured in environment variables.");

  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`USDA API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Normalize the nutrient structure to match your schema
  const normalizedNutrients = data.foodNutrients?.map((n: any) => ({
    id: n.nutrient?.id || n.nutrientId,
    name: n.nutrient?.name || n.name,
    amount: n.amount,
    unitName: n.nutrient?.unitName || n.unitName
  })) || [];

  return {
    description: data.description,
    brandOwner: data.brandOwner || data.brandName || '',
    ingredients: data.ingredients || '',
    nutrients: normalizedNutrients,
    portionSizes: data.foodPortions?.map((p: any) => ({
      description: p.modifier || p.portionDescription || 'Standard Serving',
      gramWeight: p.gramWeight
    })) || []
  };
}

/**
 * Utility: Converts Firestore Timestamps to ISO strings for the UI
 */
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

export async function getEnrichedFood(fdcId: number | string) {
  try {
    const docId = String(fdcId);
    const foodDocRef = adminDb.collection('global-food-cache').doc(docId);
    const docSnap = await foodDocRef.get();
    
    // STEP 1: CACHE CHECK
    if (docSnap.exists) {
      const rawData = docSnap.data();
      if (rawData?.nutrients && Array.isArray(rawData.nutrients) && rawData.nutrients.length > 0) {
        console.log(`[Cache Hit] Serving ${docId} from Firestore`);
        return {
          success: true,
          data: convertTimestampsToISO({ ...rawData, fdcId: Number(fdcId) }),
          error: null
        };
      }
    }

    console.log(`[Cache MISS] Fetching USDA data for ${docId}...`);

    // STEP 2: USDA DEEP FETCH
    const usdaData = await fetchUsdaDetails(fdcId);

    // STEP 3: DYNAMIC AI ENRICHMENT
    const settings = await getSiteSettingsAction();
    const modelNameFromDb = settings.data?.aiModelSettings?.flash; 
    if (!modelNameFromDb) throw new Error('Flash model not configured in site settings.');

    // We pass the REAL ingredients and description to the AI now
    const aiResult = await enrichFoodDetailsFlow({
      description: usdaData.description,
      ingredients: usdaData.ingredients,
      modelName: `googleai/${modelNameFromDb}`
    }) as any;

    // STEP 4: MERGE & SANITIZE
    const finalData = {
      ...usdaData,      // Keep USDA nutrients and portions
      ...aiResult,      // Overwrite with AI analysis (UPF, Gluten, etc.)
      fdcId: Number(fdcId),
      source: "AI_ANALYSIS",
      analysisDate: new Date().toISOString(),
    };

    // STEP 5: PERSIST TO CACHE
    await foodDocRef.set({
        ...finalData,
        searchableDescription: finalData.description.toLowerCase(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      data: convertTimestampsToISO(finalData),
      error: null
    };
  } catch (error) {
    console.error("[Action Error]:", error);
    return { 
      success: false, 
      data: null, 
      error: error instanceof Error ? error.message : "Failed to enrich food data" 
    };
  }
}

/**
 * Resolves TS Error 2554 by matching the component's expected signature
 */
export async function saveManualEnrichedFood(foodData: any, idToken?: string) {
  try {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(foodData.fdcId));
    await foodDocRef.set({
      ...foodData,
      searchableDescription: foodData.description.toLowerCase(),
      updatedAt: FieldValue.serverTimestamp(),
      analysisDate: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Save failed" };
  }
}

export async function hybridFoodSearch(query: string) {
  try {
    const snapshot = await adminDb.collection('global-food-cache')
      .where('searchableDescription', '>=', query.toLowerCase())
      .where('searchableDescription', '<=', query.toLowerCase() + '\uf8ff')
      .limit(20)
      .get();
    
    return snapshot.docs.map(doc => ({
      fdcId: Number(doc.id),
      description: doc.data().description,
      brandOwner: doc.data().brandOwner || '',
      isCached: true
    }));
  } catch (error) {
    return [];
  }
}

export async function getUnreviewedUserFoods() {
  try {
    const snapshot = await adminDb.collection('global-food-cache')
      .where('source', '==', 'USER_PROVIDED')
      .get();
    return { success: true, data: snapshot.docs.map(doc => convertTimestampsToISO(doc.data())), error: null };
  } catch (error) {
    return { success: false, data: [], error: "Failed to fetch queue" };
  }
}

export async function deleteFoodFromCache(fdcId: number) {
  try {
    await adminDb.collection('global-food-cache').doc(String(fdcId)).delete();
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Delete failed" };
  }
}

export async function generateNewFdcId() {
  return { success: true, data: Date.now(), error: null };
}