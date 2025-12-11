'use client';

import { useState, useEffect } from 'react';
import { UIMealItem, SavedMeal, EnrichedFood, Portion } from '@/types';
import { getSavedMeals, deleteUserMeal, getEnrichedFoodsByFdcIds } from '@/app/actions/nutrition-actions';
import { FoodItemRow } from './food-item-row';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SavedMealsViewProps {
  userId: string;
  onAddItemsToMeal: (items: UIMealItem[]) => void;
}

export function SavedMealsView({ userId, onAddItemsToMeal }: SavedMealsViewProps) {
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  async function fetchSavedMeals() {
    setIsLoading(true);
    const meals = await getSavedMeals(userId);
    setSavedMeals(meals);
    setIsLoading(false);
  }

  useEffect(() => {
    if (userId) {
      fetchSavedMeals();
    }
  }, [userId]);

  const handleAddMealToLog = async (meal: SavedMeal) => {
    // 1. Get all the unique FDC IDs from the saved meal.
    const fdcIds = meal.items.map(item => item.fdcId);

    // 2. Fetch the full EnrichedFood objects for these IDs.
    const enrichedFoods = await getEnrichedFoodsByFdcIds(fdcIds);
    const foodMap = new Map(enrichedFoods.map(f => [f.fdcId, f]));

    // 3. Construct the UIMealItem array.
    const uiMealItems: UIMealItem[] = meal.items.map(item => {
      const food = foodMap.get(item.fdcId);
      // The portion saved might be a simple description string. We need to find the full Portion object.
      const portion = food?.portionSizes.find(p => p.description === item.unit) || food?.portionSizes[0];
      
      if (food && portion) {
        return {
          food,
          quantity: item.quantity,
          portion: portion as Portion, 
        };
      }
      return null; // This should ideally not happen if data is consistent
    }).filter((i): i is UIMealItem => i !== null);

    if (uiMealItems.length !== meal.items.length) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load all items for the saved meal.' });
    }

    // 4. Pass the fully constructed items to the parent modal.
    onAddItemsToMeal(uiMealItems);
  };

  const handleDeleteMeal = async (mealId: string) => {
    const result = await deleteUserMeal(userId, mealId);
    if (result.success) {
      setSavedMeals((prev) => prev.filter((meal) => meal.id !== mealId));
      toast({ title: 'Meal Deleted', description: 'The saved meal has been removed.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete the saved meal.' });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (savedMeals.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        You haven't saved any meals yet. 
      </p>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {savedMeals.map((meal) => (
        <AccordionItem key={meal.id} value={meal.id ?? ''} className="border rounded-md px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex justify-between items-center w-full">
              <span className="font-semibold">{meal.name}</span>
              <span className="text-sm text-muted-foreground pr-4">
                {meal.items.length} items
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="flex flex-col gap-1 mb-4 text-sm text-muted-foreground">
                 {meal.items.map((item, index) => (
                    <div key={`${item.fdcId}-${index}`} className='ml-4'>
                        <span>{item.quantity} x {item.description}</span>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => handleAddMealToLog(meal)}>
                    Add to Current Meal
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteMeal(meal.id ?? '')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
