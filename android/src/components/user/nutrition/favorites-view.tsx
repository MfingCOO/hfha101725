'use client';

import { useState, useEffect } from 'react';
import { EnrichedFood } from '@/types';
import { getFavoriteFoods, toggleFavoriteFood } from '@/app/actions/nutrition-actions';
import { FoodItemRow } from './food-item-row';
import { Button } from '@/components/ui/button';
import { Loader2, Star } from 'lucide-react';

interface FavoritesViewProps {
  userId: string;
  onFoodSelected: (food: EnrichedFood) => void;
}

export function FavoritesView({ userId, onFoodSelected }: FavoritesViewProps) {
  const [favorites, setFavorites] = useState<EnrichedFood[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFavorites() {
      setIsLoading(true);
      try {
        const favs = await getFavoriteFoods(userId);
        // FIX: Add a filter to ensure no undefined items are in the list, making the client resilient.
        setFavorites(favs.filter(Boolean)); 
      } catch (error) {
        console.error("[FavoritesView]", error);
        setFavorites([]); // Set to empty array on error
      }
      setIsLoading(false);
    }

    if (userId) {
      fetchFavorites();
    }
  }, [userId]);

  const handleRemoveFavorite = async (e: React.MouseEvent, fdcId: number) => {
    e.stopPropagation(); // Prevent the row's onClick from firing
    
    // Optimistically update the UI
    setFavorites((prev) => prev.filter((food) => food.fdcId !== fdcId));

    const result = await toggleFavoriteFood(userId, fdcId, false);
    if (!result.success) {
      // Revert the change if the server call fails
      // This requires fetching the favorites again or temporarily storing the removed item.
      // For now, we can just refetch.
      const favs = await getFavoriteFoods(userId);
      setFavorites(favs.filter(Boolean));
      // Optionally, show an error toast to the user
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (favorites.length === 0) {
    return <p className="text-center text-muted-foreground py-8">You haven't favorited any foods yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {favorites.map((food) => (
        <FoodItemRow
          key={food.fdcId}
          food={food} // FIX: Pass the entire food object as a single prop
          onClick={() => onFoodSelected(food)}
          actions={
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => handleRemoveFavorite(e, food.fdcId)}
              aria-label="Remove from favorites"
            >
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            </Button>
          }
        />
      ))}
    </div>
  );
}
