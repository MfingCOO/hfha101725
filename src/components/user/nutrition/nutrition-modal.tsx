'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Star, Bookmark, Clock, Loader2, Barcode, Crown, PlusSquare } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { UserTier } from '@/types';
import { type EnrichedFood, type MealItem, NovaGroup, type Portion, EnrichedFoodSchema } from '@/types/nutrition';
import { UpgradeModal } from '@/components/modals/upgrade-modal';
import { CreateFoodFormModal } from '@/components/modals/CreateFoodFormModal';
import { SearchView } from './search-view';
import { FavoritesView } from './favorites-view';
import { SavedMealsView } from './saved-meals-view';
import { CurrentMealView } from './current-meal-view';
import { FoodDetailView } from './food-detail-view';
import { BarcodeScannerView } from './barcode-scanner-view';
import { ManualBarcodeInput } from '@/components/user/nutrition/manual-barcode-input';
import { Button } from '@/components/ui/button';
import { FoodItemRow } from './food-item-row';
import { toggleFavoriteFood, getFavoriteFoods } from '@/app/actions/nutrition-actions';
import { getEnrichedFood, saveManualEnrichedFood, generateNewFdcId } from '@/app/coach/food-cache/actions';
import { useSearchStore } from '@/store/search-store';
import { toast } from 'sonner';
import { useAdBanner } from '@/components/providers/AdBannerProvider';


const RECENT_FOODS_KEY = 'recentFoods';
const MAX_RECENT_FOODS = 30;

interface SimpleFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
  isCached?: boolean;
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

interface UIMealItem {
    food: EnrichedFood;
    quantity: number;
    portion: Portion;
}

const IconTab = ({ value, icon: Icon, label, onClick }: { value: string; icon: React.ElementType; label: string, onClick?: () => void; }) => (
  <TabsTrigger value={value} onClick={onClick} className="flex-1 flex flex-col items-center gap-1 px-1 py-2 h-auto">
    <Icon className="h-5 w-5" />
    <span className="text-xs">{label}</span>
  </TabsTrigger>
);

export function NutritionModal({ isOpen, onClose, onAddItems, userId }: NutritionModalProps) {
  const { userProfile } = useAuth();
  const resetSearchStore = useSearchStore((state) => state.reset);
  const { adBannerHeight } = useAdBanner();

  const [currentMealItems, setCurrentMealItems] = useState<MealItem[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  const [activeView, setActiveView] = useState<'tabs' | 'scanner' | 'manual'>('tabs');
  const [selectedFood, setSelectedFood] = useState<EnrichedFood | null>(null);
  const [favoriteFdcIds, setFavoriteFdcIds] = useState<Set<number>>(new Set());
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCreateFoodModalOpen, setIsCreateFoodModalOpen] = useState(false);

  const userCanScan = userProfile?.tier === UserTier.Premium || userProfile?.tier === UserTier.Coaching;
  const userCanCreateFood = userProfile?.tier === UserTier.Basic || userProfile?.tier === UserTier.Premium || userProfile?.tier === UserTier.Coaching;

  const handleClose = () => {
    resetSearchStore();
    onClose();
  };

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
      setActiveView('tabs');
      setSelectedFood(null);
      resetSearchStore();
    }
  }, [isOpen, fetchFavorites, resetSearchStore]);

  const handleFoodSelected = async (food: SimpleFood | EnrichedFood) => {
    console.log(`[NutritionModal] Selecting FDCID: ${food.fdcId}`);
    setIsAnalyzing(true);
    setSelectedFood(null);
    setActiveView('tabs');

    try {
      const response = await getEnrichedFood(food.fdcId);

      if (response.success && response.data) {
        const validation = EnrichedFoodSchema.safeParse(response.data);
        if (validation.success) {
            setSelectedFood(validation.data);
        } else {
            console.error("Validation failed", validation.error.flatten());
            toast.error("Format error in food data from server.");
        }
      } else {
        console.error(`[NutritionModal] Server failed to return food details for fdcId: ${food.fdcId}.`, response.error);
        toast.error(response.error || "Could not analyze food.");
      }
    } catch (error) {
      console.error("Critical Analysis Error:", error);
      toast.error("An error occurred while analyzing the food.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddItemToMeal = (item: MealItem) => {
    setCurrentMealItems(prev => [...prev, item]);
    addRecentFood(item);
    setSelectedFood(null);
  };
  
  const handleAddMultipleItemsToMeal = (items: UIMealItem[]) => {
    const newMealItems: MealItem[] = items.map(uiItem => {
        const { food, quantity, portion } = uiItem;

        const getNutrientAmount = (nutrientName: string): number => {
            const nutrient = food.nutrients?.find(n => n.name === nutrientName);
            return nutrient?.amount ?? 0;
        };

        const baseCalories = getNutrientAmount('Energy');
        const calories = (baseCalories / 100) * portion.gramWeight * quantity;

        const mealItem: MealItem = {
            ...food,
            quantity,
            unit: portion.description,
            calories,
        };
        
        addRecentFood(food);
        return mealItem;
    });

    setCurrentMealItems(prev => [...prev, ...newMealItems]);
};


  const handleRemoveItem = (indexToRemove: number) => {
    setCurrentMealItems(prev => prev.filter((_, i) => i !== indexToRemove));
  };
  
  const handleClearMeal = () => {
    setCurrentMealItems([]);
  };

  const handleAddMealAndClose = () => {
    onAddItems(currentMealItems);
    handleClearMeal();
    handleClose();
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
        setFavoriteFdcIds(new Set(favoriteFdcIds));
    }
  };

  const handleScanClick = () => {
      if (userCanScan) {
          setActiveView('scanner');
      } else {
          setIsUpgradeModalOpen(true);
      }
  }

  const handleCreateFoodClick = () => {
    if (userCanCreateFood) {
        setIsCreateFoodModalOpen(true);
    } else {
        console.log("User does not have permission to create food.");
    }
  };

  const renderPrimaryView = () => {
    if (activeView === 'scanner') {
      return (
        <BarcodeScannerView 
          onFoodScanned={handleFoodSelected} 
          onClose={() => setActiveView('tabs')} 
          onManualEntryClick={() => setActiveView('manual')}
        />
      );
    }

    if (activeView === 'manual') {
        return (
            <ManualBarcodeInput
                onFoodScanned={handleFoodSelected}
                onClose={() => setActiveView('tabs')}
                onBackToScanClick={() => setActiveView('scanner')}
            />
        );
    }
    
    if (selectedFood) {
        return (
            <FoodDetailView 
              food={selectedFood}
              onBack={() => setSelectedFood(null)}
              onAddItem={handleAddItemToMeal}
              isFavorite={favoriteFdcIds.has(selectedFood.fdcId)}
              onToggleFavorite={handleToggleFavorite}
            />
        );
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-6 h-auto">
                <IconTab value="search" icon={Search} label="Search" />
                <IconTab value="recents" icon={Clock} label="Recents" />
                <IconTab value="favorites" icon={Star} label="Favorites" />
                <IconTab value="meals" icon={Bookmark} label="Saved" />
                <IconTab 
                    value="scan" 
                    icon={userCanScan ? Barcode : Crown} 
                    label={userCanScan ? "Scan" : "Upgrade"} 
                    onClick={handleScanClick} 
                />
                {userCanCreateFood && (
                    <IconTab 
                        value="add" 
                        icon={PlusSquare} 
                        label="Add" 
                        onClick={handleCreateFoodClick} 
                    />
                )}
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
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        activeView === 'scanner' ? 'Scan Barcode' :
        activeView === 'manual' ? 'Enter Barcode' :
        selectedFood ? 'Food Details' : 'Search & Add Food'
      }
      className="h-[90dvh] w-[95vw] sm:max-w-4xl flex flex-col"
      footer={
        currentMealItems.length > 0 ? (
            <div className="flex justify-between items-center w-full">
                <p className="text-xs text-muted-foreground">Once you hit &quot;Add Item(s) to Log&quot; your meal will appear on your calendar to view/edit.</p>
                <Button onClick={handleAddMealAndClose}>
                    Add {currentMealItems.length} Item(s) to Log
                </Button>
            </div>
        ) : null
      }
    >
      <div 
        className="flex flex-col gap-4 flex-1 min-h-0"
        style={{ paddingBottom: `${adBannerHeight}px` }}
      >
        {currentMealItems.length > 0 && (
            <div className="flex-shrink-0 bg-background/50 rounded-lg p-4">
               <CurrentMealView 
                items={currentMealItems}
                onRemoveItem={handleRemoveItem}
                onClearMeal={handleClearMeal}
                userId={userId}
               />
            </div>
        )}

        <div className="flex flex-col space-y-4 min-h-0 flex-1 relative">
          {isAnalyzing && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 rounded-lg">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {renderPrimaryView()}
        </div>
      </div>
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        requiredTier={UserTier.Premium}
        featureName="Barcode Scanner"
        reason="Upgrade to a Premium or Coaching plan to get instant food details by scanning barcodes. Fast, easy, and accurate logging is just an upgrade away."
        />
       <CreateFoodFormModal 
            isOpen={isCreateFoodModalOpen}
            onClose={() => setIsCreateFoodModalOpen(false)}
        />
    </BaseModal>
  );
}
