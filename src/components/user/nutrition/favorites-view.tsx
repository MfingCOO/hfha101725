'use client';

import { useState, useEffect } from 'react';
import { EnrichedFood } from '@/types';
import { getFavoriteFoods, toggleFavoriteFood } from '@/app/actions/nutrition-actions';
import { FoodItemRow } from './food-item-row';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Star } from 'lucide-react';

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
      const favs = await getFavoriteFoods(userId);
      setFavorites(favs);
      setIsLoading(false);
    }

    if (userId) {
      fetchFavorites();
    }
  }, [userId]);

  const handleRemoveFavorite = async (fdcId: number) => {
    const result = await toggleFavoriteFood(userId, fdcId, false);
    if (result.success) {
      // Remove the item from the local state for instant UI feedback
      setFavorites((prev) => prev.filter((food) => food.fdcId !== fdcId));
      // Optionally, show a success toast
    } else {
      // Optionally, show an error toast
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (favorites.length === 0) {
    return <p className="text-center text-muted-foreground py-8">You haven't favorited any foods yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {favorites.map((food) => (
        <FoodItemRow
          key={food.fdcId}
          description={food.description}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFoodSelected(food)}
              >
                Select
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFavorite(food.fdcId)}
                aria-label="Remove from favorites"
              >
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              </Button>
            </div>
          }
        />
      ))}
    </div>
  );
}
