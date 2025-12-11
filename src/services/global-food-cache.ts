
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { EnrichedFood } from '@/types';

const GLOBAL_CACHE_COLLECTION = 'global-food-cache';

/**
 * Retrieves a cached enriched food item from the global Firestore cache.
 * This function is intended for server-side use only.
 * @param {string} fdcId The FoodData Central ID of the food to retrieve.
 * @returns {Promise<EnrichedFood | null>} The cached food data or null if not found.
 */
export const getCachedFood = async (fdcId: string): Promise<EnrichedFood | null> => {
  try {
    const docRef = doc(db, GLOBAL_CACHE_COLLECTION, fdcId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as EnrichedFood;
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving cached food for fdcId ${fdcId}:`, error);
    return null;
  }
};

/**
 * Saves an enriched food item to the global Firestore cache.
 * This function is intended for server-side use only.
 * @param {EnrichedFood} foodData The complete enriched food data to cache.
 * @returns {Promise<void>}
 */
export const setCachedFood = async (foodData: EnrichedFood): Promise<void> => {
  if (!foodData?.fdcId) {
    console.error('Attempted to cache food without a valid fdcId.');
    return;
  }

  try {
    const docRef = doc(db, GLOBAL_CACHE_COLLECTION, String(foodData.fdcId));
    await setDoc(docRef, foodData, { merge: true });
  } catch (error) {
    console.error(`Error caching food for fdcId ${foodData.fdcId}:`, error);
  }
};
