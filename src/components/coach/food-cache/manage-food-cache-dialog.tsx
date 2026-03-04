'use server';

import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';
import { db as adminDb } from '@/lib/firebaseAdmin'; 
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { EnrichedFood } from '@/types/nutrition';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

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
};

export async function getEnrichedFood(fdcId: number | string) {
  try {
    const docId = String(fdcId);
    const foodDocRef = adminDb.collection('global-food-cache').doc(docId);
    const docSnap = await foodDocRef.get();
    
    if (docSnap.exists) {
      const rawData = docSnap.data();
      if (rawData?.nutrients?.length > 0) {
        return {
          success: true,
          data: convertTimestampsToISO({ ...rawData, fdcId: Number(fdcId) }),
          error: null
        };
      }
    }

    const settings = await getSiteSettingsAction();
    const modelNameFromDb = settings.data?.aiModelSettings?.flash; 
    if (!modelNameFromDb) throw new Error('Flash model not configured.');

    const aiResult = await enrichFoodDetailsFlow({
      description: "Food Item " + fdcId,
      ingredients: "",
      modelName: `googleai/${modelNameFromDb}`
    }) as any;

    const finalData = {
      ...aiResult,
      fdcId: Number(fdcId),
      source: "AI_ANALYSIS",
      analysisDate: new Date().toISOString(),
    };

    await foodDocRef.set({
        ...finalData,
        searchableDescription: finalData.description.toLowerCase(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { success: true, data: finalData, error: null };
  } catch (error) {
    return { success: false, data: null, error: "Failed to load food" };
  }
}

/**
 * FIXED: Accepts two arguments to resolve TS Error 2554
 */
export async function saveManualEnrichedFood(foodData: any, idToken?: string) {
  try {
    const foodDocRef = adminDb.collection('global-food-cache').doc(String(foodData.fdcId));
    
    const dataToSave = {
      ...foodData,
      searchableDescription: foodData.description.toLowerCase(),
      updatedAt: FieldValue.serverTimestamp(),
      analysisDate: FieldValue.serverTimestamp()
    };

    await foodDocRef.set(dataToSave, { merge: true });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: "Failed to save food" };
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