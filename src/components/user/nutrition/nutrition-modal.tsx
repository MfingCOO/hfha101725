
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Star, Bookmark, Clock, Loader2 } from 'lucide-react';
import { SearchView } from './search-view';
import { FavoritesView } from './favorites-view';
import { SavedMealsView } from './saved-meals-view';
import { CurrentMealView } from './current-meal-view';
import { FoodDetailView } from './food-detail-view';
import { type EnrichedFood, type MealItem, NovaGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { FoodItemRow } from './food-item-row';
import { toggleFavoriteFood, getFavoriteFoods } from '@/app/actions/nutrition-actions';
import { getOrEnrichFoodForUser } from '@/app/coach/food-cache/actions';

const RECENT_FOODS_KEY = 'recentFoods';
const MAX_RECENT_FOODS = 30;

interface SimpleFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
}

const addRecentFood = (food: EnrichedFood) => {
  if (typeof window === 'undefined') return;
  try {
    const recents = JSON.parse(localStorage.getItem(RECENT_FOODS_KEY) || '[]') as EnrichedFood[];
    const filteredRecents = recents.filter(f => f.fdcId !== food.fdcId);
    const newRecents = [food, ...filteredRecents].slice(0, MAX_RECENT_FOODS);
    localStorage.setItem(RECENT_FOODS_KEY, JSON.stringify(newRecents));
  } catch (error) {
    console.error("Failed to save recent food:", error);
  }
};

const RecentsView = ({ onFoodSelected }: { onFoodSelected: (food: EnrichedFood) => void; }) => {
  const [recentFoods, setRecentFoods] = useState<EnrichedFood[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRecents = localStorage.getItem(RECENT_FOODS_KEY);
      if (storedRecents) {
        try {
          setRecentFoods(JSON.parse(storedRecents));
        } catch (error) {
          console.error("Failed to parse recent foods from localStorage:", error);
        }
      }
    }
  }, []);

  if (recentFoods.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No recent foods. Foods you add to a meal will appear here.</div>;
  }

  return (
    <div className="space-y-2 py-4">
      {recentFoods.map(food => {
        const foodForRender = {
            fdcId: food.fdcId ?? 0,
            description: food.description ?? 'Unnamed Food',
            brandOwner: food.brandOwner,
            ingredients: food.ingredients,
            upfAnalysis: food.upfAnalysis ?? { rating: NovaGroup.UNCLASSIFIED, justification: '' },
            glutenAnalysis: food.glutenAnalysis ?? { isGlutenFree: false, justification: '' }
        };
        return <FoodItemRow key={food.fdcId} food={foodForRender} onClick={() => onFoodSelected(food)} />
      })}
    </div>
  );
};


export interface NutritionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: MealItem[]) => void;
  userId: string;
}

const IconTab = ({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) => (
  <TabsTrigger value={value} className="flex-1 flex flex-col items-center gap-1 p-2 h-auto">
    <Icon className="h-5 w-5" />
    <span className="text-xs">{label}</span>
  </TabsTrigger>
);

export function NutritionModal({ isOpen, onClose, onAddItems, userId }: NutritionModalProps) {
  const [currentMealItems, setCurrentMealItems] = useState<MealItem[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  const [selectedFood, setSelectedFood] = useState<EnrichedFood | null>(null);
  const [favoriteFdcIds, setFavoriteFdcIds] = useState<Set<number>>(new Set());
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    setIsLoadingFavorites(true);
    try {
      const favorites = await getFavoriteFoods(userId);
      setFavoriteFdcIds(new Set(favorites.map(f => f.fdcId)));
    } catch (error) {
        console.error("Failed to fetch favorites", error)
    } finally {
        setIsLoadingFavorites(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      fetchFavorites();
      setCurrentMealItems([]);
      setActiveTab('search');
      setSelectedFood(null);
    }
  }, [isOpen, fetchFavorites]);

  const handleFoodSelected = async (food: SimpleFood | EnrichedFood) => {
    console.log(`[NutritionModal] Handling selection for ${food.fdcId}. Starting analysis.`);
    setIsAnalyzing(true);
    setSelectedFood(null);

    try {
      const enrichedFood = await getOrEnrichFoodForUser(food.fdcId);
      
      if (enrichedFood) {
        console.log(`[NutritionModal] Analysis complete for ${food.fdcId}.`);
        setSelectedFood(enrichedFood);
      } else {
        console.error(`[NutritionModal] Analysis failed for fdcId: ${food.fdcId}.`);
      }
    } catch (error) {
      console.error("[NutritionModal] CRITICAL: An error occurred during food analysis:", error);
    } finally {
      console.log(`[NutritionModal] Analysis process finished for ${food.fdcId}.`);
      setIsAnalyzing(false);
    }
  };

  const handleAddItemToMeal = (item: MealItem) => {
    setCurrentMealItems(prev => [...prev, item]);
    // CORRECTED: The 'item' is a complete MealItem which now includes all EnrichedFood
    // properties, so it can be passed directly to addRecentFood. The old, hacky
    // logic of relying on 'selectedFood' is no longer needed.
    addRecentFood(item);
    setSelectedFood(null);
  };
  
  const handleAddMultipleItemsToMeal = (items: MealItem[]) => {
      setCurrentMealItems(prev => [...prev, ...items]);
      // CORRECTED: Since MealItem now correctly contains all EnrichedFood data,
      // we can pass each item directly to addRecentFood. The complex and unsafe
      // reconstruction of the object is no longer necessary.
      items.forEach(item => {
        addRecentFood(item);
      });
  }

  const handleRemoveItem = (indexToRemove: number) => {
    setCurrentMealItems(prev => prev.filter((_, i) => i !== indexToRemove));
  };
  
  const handleClearMeal = () => {
    setCurrentMealItems([]);
  };

  const handleAddMealAndClose = () => {
    onAddItems(currentMealItems);
    handleClearMeal();
    onClose();
  };

  const handleToggleFavorite = async () => {
    if (!selectedFood) return;

    const foodToToggle = selectedFood;
    const isCurrentlyFavorite = favoriteFdcIds.has(foodToToggle.fdcId);
    const newIsFavorite = !isCurrentlyFavorite;

    const optimisticIds = new Set(favoriteFdcIds);
    if (newIsFavorite) {
      optimisticIds.add(foodToToggle.fdcId);
    } else {
      optimisticIds.delete(foodToToggle.fdcId);
    }
    setFavoriteFdcIds(optimisticIds);

    try {
        await toggleFavoriteFood(userId, foodToToggle.fdcId, newIsFavorite);
    } catch (error) {
        console.error('Failed to toggle favorite', error);
        // Revert on failure
        setFavoriteFdcIds(new Set(favoriteFdcIds));
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedFood ? 'Food Details' : 'Search & Add Food'}
      className="h-[90dvh] w-[95vw] sm:max-w-4xl flex flex-col"
      footer={
        currentMealItems.length > 0 ? (
            <div className="flex justify-end w-full">
                <Button onClick={handleAddMealAndClose}>
                    Add {currentMealItems.length} Item(s) to Log
                </Button>
            </div>
        ) : null
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col space-y-4 min-h-0 relative">
          {isAnalyzing && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 rounded-lg">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {selectedFood ? (
            <FoodDetailView 
              food={selectedFood}
              onBack={() => setSelectedFood(null)}
              onAddItem={handleAddItemToMeal}
              isFavorite={favoriteFdcIds.has(selectedFood.fdcId)}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <IconTab value="search" icon={Search} label="Search" />
                <IconTab value="recents" icon={Clock} label="Recents" />
                <IconTab value="favorites" icon={Star} label="Favorites" />
                <IconTab value="meals" icon={Bookmark} label="Saved" />
              </TabsList>
              {isLoadingFavorites && !isAnalyzing ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
              ) : (
                <>
                  <TabsContent value="search" className="flex-1 overflow-auto">
                    <SearchView onFoodSelected={handleFoodSelected} />
                  </TabsContent>
                  <TabsContent value="recents" className="flex-1 overflow-auto">
                    <RecentsView onFoodSelected={handleFoodSelected} />
                  </TabsContent>
                  <TabsContent value="favorites" className="flex-1 overflow-auto">
                    <FavoritesView onFoodSelected={handleFoodSelected} userId={userId} />
                  </TabsContent>
                  <TabsContent value="meals" className="flex-1 overflow-auto">
                     <SavedMealsView onAddItemsToMeal={handleAddMultipleItemsToMeal} userId={userId} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </div>

        <div className="flex flex-col min-h-0 bg-background/50 rounded-lg p-4">
           <CurrentMealView 
            items={currentMealItems}
            onRemoveItem={handleRemoveItem}
            onClearMeal={handleClearMeal}
            userId={userId}
           />
        </div>
      </div>
    </BaseModal>
  );
}
