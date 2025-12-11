'use client';

import * as React from 'react';
import type { EnrichedFood, MealItem, PortionSize } from '@/types';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Star, Plus, UtensilsCrossed, Beef, Droplet, Wheat, Leaf, Shield
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FoodDetailViewProps {
  food: EnrichedFood;
  onBack: () => void;
  onAddItem: (item: MealItem) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function FoodDetailView({ food, onBack, onAddItem, isFavorite, onToggleFavorite }: FoodDetailViewProps) {
  const availablePortions = food.portionSizes || [];
  const [quantity, setQuantity] = React.useState(1);
  const [selectedPortion, setSelectedPortion] = React.useState<PortionSize | undefined>(availablePortions[0]);

  const canAddItem = !!selectedPortion;

  React.useEffect(() => {
    setSelectedPortion((food.portionSizes && food.portionSizes.length > 0) ? food.portionSizes[0] : undefined);
    setQuantity(1);
  }, [food]);

  const calculatedNutrients = React.useMemo(() => {
    if (!food.nutrients) {
      return { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };
    }
    const getNutrientValue = (name: string) => {
      const nutrient = food.nutrients.find(n => n.name.toLowerCase() === name.toLowerCase());
      const gramWeight = selectedPortion?.gramWeight ?? 0;
      if (!nutrient) return 0;
      return (nutrient.amount / 100) * gramWeight * quantity;
    };

    return {
      protein: getNutrientValue('Protein'),
      carbs: getNutrientValue('Carbohydrate, by difference'),
      fat: getNutrientValue('Total lipid (fat)'),
      calories: getNutrientValue('Energy'),
      fiber: getNutrientValue('Fiber, total dietary'),
    };
  }, [food.nutrients, quantity, selectedPortion]);

  const handleAdd = () => {
    if (!canAddItem || !selectedPortion) return;

    // CORRECTED: Use the spread operator to ensure all data from the EnrichedFood
    // object is preserved, and then add the instance-specific details.
    // This conforms to the new robust MealItem type from Step 1.
    const mealItem: MealItem = {
        ...food, // Spread all properties from the EnrichedFood object
        quantity: quantity,
        unit: selectedPortion.description,
        calories: calculatedNutrients.calories,
    };
    onAddItem(mealItem);
  };
  
  const getUpfBadgeProps = (upfPercentage: number | undefined | null) => {
    if (upfPercentage === undefined || upfPercentage === null) return null;

    if (upfPercentage <= 10) {
        return { className: 'bg-green-100 text-green-900 border-green-200', label: 'Whole Food' };
    } else if (upfPercentage <= 20) {
        return { className: 'bg-yellow-100 text-yellow-900 border-yellow-200', label: 'Processed' };
    } else {
        return { className: 'bg-red-100 text-red-900 border-red-200', label: 'UPF' };
    }
  };

  const upfBadgeProps = getUpfBadgeProps(food.upfPercentage?.value);
  const isGlutenFree = food.glutenAnalysis?.isGlutenFree;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
          <ArrowLeft />
        </Button>
        <div className="flex-1 truncate">
            <h2 className="text-xl font-bold truncate">{food.description}</h2>
            <div className="flex items-center gap-2 mt-1">
                {upfBadgeProps && <Badge className={cn(upfBadgeProps.className, 'border-2')}>{upfBadgeProps.label}</Badge>}
                {isGlutenFree && <Badge className="bg-blue-100 text-blue-900 border-blue-200 border-2">Gluten-Free</Badge>}
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleFavorite} className="ml-2 flex-shrink-0">
          <Star className={isFavorite ? 'fill-yellow-400 text-yellow-500' : ''} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <div className="grid grid-cols-6 gap-1 text-center p-2 rounded-lg bg-muted/50 mb-4">
            <div className="flex flex-col items-center justify-center">
                <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold">{calculatedNutrients.calories.toFixed(0)}</span>
                <span className="text-[10px] text-muted-foreground -mt-1">kcal</span>
            </div>
            <div className="flex flex-col items-center justify-center">
                <Beef className="h-4 w-4 text-red-400" />
                <span className="text-sm font-bold">{calculatedNutrients.protein.toFixed(0)}g</span>
                <span className="text-[10px] text-muted-foreground -mt-1">Protein</span>
            </div>
            <div className="flex flex-col items-center justify-center">
                <Droplet className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold">{calculatedNutrients.fat.toFixed(0)}g</span>
                <span className="text-[10px] text-muted-foreground -mt-1">Fat</span>
            </div>
            <div className="flex flex-col items-center justify-center">
                <Wheat className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-bold">{calculatedNutrients.carbs.toFixed(0)}g</span>
                <span className="text-[10px] text-muted-foreground -mt-1">Carbs</span>
            </div>
            <div className="flex flex-col items-center justify-center">
                <Leaf className="h-4 w-4 text-green-400" />
                <span className="text-sm font-bold">{calculatedNutrients.fiber.toFixed(1)}g</span>
                <span className="text-[10px] text-muted-foreground -mt-1">Fiber</span>
            </div>
            <div className="flex flex-col items-center justify-center">
                <Shield className="h-4 w-4 text-red-400" />
                <span className="text-sm font-bold">{food.upfPercentage?.value ?? 0}%</span>
                <span className="text-[10px] text-muted-foreground -mt-1">UPF</span>
            </div>
        </div>

        {food.brandOwner && <p className="text-sm text-muted-foreground pt-2">{food.brandOwner}</p>}

        {food.ingredients && (
          <div>
            <h3 className="font-semibold mb-1">Ingredients</h3>
            <div className="max-h-28 overflow-y-auto bg-muted/50 p-2 rounded-md">
                <p className="text-sm text-muted-foreground italic">{food.ingredients}</p>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">Serving Size</h3>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20"
            />
            <Select
              value={selectedPortion?.description}
              onValueChange={(value) => {
                const newPortion = availablePortions.find(s => s.description === value);
                if (newPortion) setSelectedPortion(newPortion);
              }}
              disabled={!canAddItem}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={canAddItem ? "Select portion" : "No portions available"} />
              </SelectTrigger>
              <SelectContent>
                {availablePortions.map(s => (
                  <SelectItem key={s.description} value={s.description}>
                    {s.description} ({s.gramWeight}g)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      <div className="mt-4 flex justify-end">
          <Button onClick={handleAdd} disabled={!canAddItem}>
              <Plus className="mr-2 h-4 w-4" /> Add to Meal
          </Button>
      </div>
    </div>
  );
}
