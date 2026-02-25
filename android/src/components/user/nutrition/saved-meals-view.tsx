'use client';

import { useState, useEffect } from 'react';
import { SavedMeal, EnrichedFood, Portion, MealItem } from '@/types';
import { getSavedMeals, deleteUserMeal } from '@/app/actions/nutrition-actions';
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

// The UIMealItem is what the parent component (the meal log) expects to receive.
interface UIMealItem {
  food: EnrichedFood;
  quantity: number;
  portion: Portion;
}

interface SavedMealsViewProps {
  userId: string;
  onAddItemsToMeal: (items: UIMealItem[]) => void;
}

// FIX: Define a type for the items within our saved meals that includes the full food details.
interface EnrichedMealItem extends MealItem {
  enrichedFood: EnrichedFood;
}

// FIX: Update the SavedMeal type to use the new EnrichedMealItem.
interface EnrichedSavedMeal extends Omit<SavedMeal, 'items'> {
  items: EnrichedMealItem[];
}

export function SavedMealsView({ userId, onAddItemsToMeal }: SavedMealsViewProps) {
  // FIX: Use the new EnrichedSavedMeal type for the component's state.
  const [savedMeals, setSavedMeals] = useState<EnrichedSavedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  async function fetchSavedMeals() {
    setIsLoading(true);
    // FIX: The getSavedMeals action now returns the fully enriched data.
    const meals = await getSavedMeals(userId);
    setSavedMeals(meals as EnrichedSavedMeal[]);
    setIsLoading(false);
  }

  useEffect(() => {
    if (userId) {
      fetchSavedMeals();
    }
  }, [userId]);

  const handleAddMealToLog = (meal: EnrichedSavedMeal) => {
    // FIX: The items are already enriched, so we can construct the UIMealItem array directly.
    const uiMealItems: UIMealItem[] = meal.items.map(item => {
      const food = item.enrichedFood;
      // Find the correct portion object from the full food details.
      const portion = food.portionSizes.find(p => p.description === item.unit) || food.portionSizes[0];
      
      if (food && portion) {
        return {
          food,
          quantity: item.quantity,
          portion: portion as Portion,
        };
      }
      return null;
    }).filter((i): i is UIMealItem => i !== null);

    if (uiMealItems.length !== meal.items.length) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load all items for the saved meal.' });
    }

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
    return <p className="text-center text-muted-foreground py-8">You haven't saved any meals yet.</p>;
  }

  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {savedMeals.map((meal) => (
        <AccordionItem key={meal.id} value={meal.id ?? ''} className="border rounded-md px-4">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex justify-between items-center w-full">
              <span className="font-semibold">{meal.name}</span>
              <span className="text-sm text-muted-foreground pr-4">{meal.items.length} items</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="flex flex-col gap-1 mb-4">
                {/* FIX: Render the FoodItemRow directly using the enrichedFood object. */}
                {meal.items.map((item, index) => (
                    <FoodItemRow
                        key={`${item.fdcId}-${index}`}
                        food={item.enrichedFood}
                        subDescription={`${item.quantity} x ${item.unit}`}
                    />
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
