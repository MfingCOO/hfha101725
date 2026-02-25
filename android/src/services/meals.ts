
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import {EnrichedFoodItem, Food, SavedMeal} from '@/types/foods';
import { ServingOptionSchema } from '@/types/foods';

const FOOD_CACHE_COLLECTION = 'global-food-cache';
const USER_DATA_COLLECTION = 'userData';

const RECENTS_COLLECTION = 'recents';
const FAVORITES_COLLECTION = 'favorites';
const SAVED_MEALS_COLLECTION = 'savedMeals';


// --- Caching Functions --- //

export const getEnrichedFood = async (fdcId: string): Promise<EnrichedFoodItem | null> => {
    try {
        const docRef = db.collection(FOOD_CACHE_COLLECTION).doc(String(fdcId));
        const doc = await docRef.get();

        if (!doc.exists) return null;

        const data = doc.data();
        
        const food: Food = {
            fdcId: data?.fdcId,
            description: data?.description,
            brandOwner: data?.brandOwner,
            ingredients: data?.ingredients,
            foodCategory: data?.foodCategory,
            dataType: data?.dataType,
            nutrients: data?.nutrients || {},
            servingOptions: (data?.servingOptions || []).map((opt: any) => ServingOptionSchema.parse(opt)),
            attributes: {
                isGlutenFree: data?.attributes?.isGlutenFree || false,
            },
            completenessScore: 0,
        };

        const enrichedItem: EnrichedFoodItem = {
            food: food,
            upf: {
                score: data?.upf?.score || 0,
                classification: data?.upf?.classification || 'yellow',
                reasoning: data?.upf?.reasoning || 'No reasoning provided.',
            },
        };

        return enrichedItem;
    } catch (error) {
        console.error(`Error getting enriched food (fdcId: ${fdcId}) from cache:`, error);
        return null;
    }
};

export const saveEnrichedFood = async (enrichedFood: EnrichedFoodItem): Promise<void> => {
    if (!enrichedFood || !enrichedFood.food.fdcId) return;

    try {
        const docRef = db.collection(FOOD_CACHE_COLLECTION).doc(String(enrichedFood.food.fdcId));
        const dataToSave = {
            ...enrichedFood.food,
            upf: enrichedFood.upf
        };
        await docRef.set(dataToSave);
    } catch (error) {
        console.error(`Error saving enriched food (fdcId: ${enrichedFood.food.fdcId}) to cache:`, error);
    }
};

// --- User-Specific Functions --- //

export const addRecentFood = async (userId: string, food: EnrichedFoodItem): Promise<void> => {
    try {
        const recentRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(RECENTS_COLLECTION).doc(String(food.food.fdcId));
        await recentRef.set({
            ...food,
            addedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error('Error adding recent food:', error);
    }
};

export const getRecentFoods = async (userId: string): Promise<EnrichedFoodItem[]> => {
    try {
        const recentsRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(RECENTS_COLLECTION).orderBy('addedAt', 'desc').limit(20);
        const snapshot = await recentsRef.get();
        return snapshot.docs.map(doc => doc.data() as EnrichedFoodItem);
    } catch (error) {
        console.error('Error getting recent foods:', error);
        return [];
    }
};

export const toggleFavoriteFood = async (userId: string, food: EnrichedFoodItem): Promise<{isFavorited: boolean}> => {
    try {
        const favoriteRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(FAVORITES_COLLECTION).doc(String(food.food.fdcId));
        const doc = await favoriteRef.get();

        if (doc.exists) {
            await favoriteRef.delete();
            return {isFavorited: false};
        } else {
            await favoriteRef.set(food);
            return {isFavorited: true};
        }
    } catch (error) {
        console.error('Error toggling favorite food:', error);
        throw error;
    }
};

export const getFavoriteFoods = async (userId: string): Promise<EnrichedFoodItem[]> => {
    try {
        const favoritesRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(FAVORITES_COLLECTION);
        const snapshot = await favoritesRef.get();
        return snapshot.docs.map(doc => doc.data() as EnrichedFoodItem);
    } catch (error) {
        console.error('Error getting favorite foods:', error);
        return [];
    }
};


export const saveMeal = async (userId: string, mealName: string, items: EnrichedFoodItem[]): Promise<void> => {
    if (!mealName.trim() || items.length === 0) return;
    try {
        const mealRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(SAVED_MEALS_COLLECTION).doc();
        const meal: SavedMeal = {
            id: mealRef.id,
            name: mealName,
            items: items,
        };
        await mealRef.set(meal);
    } catch (error) {
        console.error('Error saving meal:', error);
        throw error;
    }
};


export const getSavedMeals = async (userId: string): Promise<SavedMeal[]> => {
    try {
        const mealsRef = db.collection(USER_DATA_COLLECTION).doc(userId).collection(SAVED_MEALS_COLLECTION);
        const snapshot = await mealsRef.get();
        return snapshot.docs.map(doc => doc.data() as SavedMeal);
    } catch (error) {
        console.error('Error getting saved meals:', error);
        return [];
    }
};
