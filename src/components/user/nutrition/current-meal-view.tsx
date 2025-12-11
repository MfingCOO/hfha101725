'use client';

import { useState, useMemo } from 'react';
import { MealItem, EnrichedFood, NovaGroup } from '@/types';
import { FoodItemRow } from './food-item-row';
import { Button } from '@/components/ui/button';
import { Trash2, Save, Loader2, Beef, Brain, Wheat, Sprout, ShieldAlert, UtensilsCrossed } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveUserMeal } from '@/app/actions/nutrition-actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CurrentMealViewProps {
  items: MealItem[];
  onRemoveItem: (itemIndex: number) => void;
  onClearMeal: () => void;
  userId: string;
}

// --- HELPERS ---
const getNutrientFromMealItem = (item: MealItem, name: string): number => {
    return item.nutrients?.find(n => n.name === name)?.amount || 0;
};

const calculateNutrients = (item: MealItem) => {
    const selectedPortion = item.portionSizes?.find(p => p.description === item.unit);
    const gramWeight = selectedPortion?.gramWeight ?? 100;
    const ratio = (gramWeight / 100) * item.quantity;
    
    return {
        calories: getNutrientFromMealItem(item, 'Energy') * ratio,
        protein: getNutrientFromMealItem(item, 'Protein') * ratio,
        fat: getNutrientFromMealItem(item, 'Total lipid (fat)') * ratio,
        carbs: getNutrientFromMealItem(item, 'Carbohydrate, by difference') * ratio,
        fiber: getNutrientFromMealItem(item, 'Fiber, total dietary') * ratio,
    };
};

const UPF_CLASSES = {
    green: 'border-green-500/40 bg-green-500/20 text-green-300',
    yellow: 'border-yellow-500/40 bg-yellow-500/20 text-yellow-300',
    red: 'border-red-500/40 bg-red-500/20 text-red-300',
};

const UPFBadge = ({ classification, showText = true }: { classification: 'green' | 'yellow' | 'red', showText?: boolean }) => {
    const config = {
        green: { label: 'Whole Food' },
        yellow: { label: 'Processed' },
        red: { label: 'UPF' },
    };
    const { label } = config[classification];
    return <Badge variant="outline" className={cn("text-[10px] px-1 py-0", UPF_CLASSES[classification])}>{showText && label}</Badge>;
};

// --- MAIN COMPONENT ---
export function CurrentMealView({ items, onRemoveItem, onClearMeal, userId }: CurrentMealViewProps) {
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveMeal = async () => {
    if (!mealName.trim() || items.length === 0) return;
    setIsSaving(true);
    
    const apiItems: MealItem[] = items.map(item => ({
        ...item,
        calories: calculateNutrients(item).calories,
    }));

    try {
      await saveUserMeal(userId, mealName, apiItems);
      setMealName('');
      setIsSaveOpen(false);
      onClearMeal();
    } catch (error) {
      console.error("Failed to save meal:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const totals = useMemo(() => {
    const runningTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, upfScore: 0, upfItems: 0 };
    items.forEach(item => {
        const itemNutrients = calculateNutrients(item);
        runningTotals.calories += itemNutrients.calories;
        runningTotals.protein += itemNutrients.protein;
        runningTotals.fat += itemNutrients.fat;
        runningTotals.carbs += itemNutrients.carbs;
        runningTotals.fiber += itemNutrients.fiber;
        if (item.upfPercentage?.value) {
            runningTotals.upfScore += item.upfPercentage.value;
            runningTotals.upfItems++;
        }
    });
    const avgUpf = runningTotals.upfItems > 0 ? runningTotals.upfScore / runningTotals.upfItems : 0;
    return {...runningTotals, avgUpf };
  }, [items]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold tracking-tight">Current Meal</h3>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm"> <Save className="h-4 w-4 mr-2"/> Save Meal</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Save Meal</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Label htmlFor="meal-name" className="text-right">Meal Name</Label>
                        <Input id="meal-name" value={mealName} onChange={(e) => setMealName(e.target.value)} className="col-span-3" placeholder="e.g., Morning Breakfast"/>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveMeal} disabled={isSaving || !mealName.trim()}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Button variant="link" size="sm" className="text-destructive h-auto p-0" onClick={onClearMeal}>Clear All</Button>
          </div>
        )}
      </div>
      
      {items.length > 0 && (
         <div className="grid grid-cols-6 gap-1 text-center p-2 rounded-lg bg-muted/50">
            {[{i:UtensilsCrossed,c:'amber',l:'kcal',v:totals.calories,f:0},{i:Beef,c:'red',l:'Protein',v:totals.protein,f:0,u:'g'},{i:Brain,c:'blue',l:'Fat',v:totals.fat,f:0,u:'g'},{i:Wheat,c:'orange',l:'Carbs',v:totals.carbs,f:0,u:'g'},{i:Sprout,c:'green',l:'Fiber',v:totals.fiber,f:1,u:'g'},{i:ShieldAlert,c:'red',l:'UPF',v:totals.avgUpf,f:0,u:'%'}].map(m=>(
                <div className="flex flex-col items-center justify-center" key={m.l}>
                    <m.i className={cn(`h-4 w-4 text-${m.c}-400`)} />
                    <span className="text-sm font-bold">{m.v.toFixed(m.f)}{m.u || ''}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">{m.l}</span>
                </div>
            ))}
        </div>
      )}

      <div className="flex-grow overflow-y-auto pr-2 -mr-2">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full rounded-lg bg-background">
            <p className="text-center text-muted-foreground py-8 px-4">Search for a food to begin building a meal.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, index) => {
                const foodForRender = {
                    fdcId: item.fdcId ?? 0,
                    description: item.description ?? 'No description',
                    brandOwner: item.brandOwner,
                    ingredients: item.ingredients,
                    nutrients: item.nutrients,
                    upfAnalysis: item.upfAnalysis,
                    glutenAnalysis: item.glutenAnalysis,
                    upfPercentage: item.upfPercentage,
                    portionSizes: item.portionSizes,
                    source: item.source
                };

                let classification: 'red' | 'yellow' | 'green' | null = null;
                if (foodForRender.upfAnalysis?.rating === NovaGroup.UPF) {
                    classification = 'red';
                } else if (foodForRender.upfAnalysis?.rating === NovaGroup.PROCESSED) {
                    classification = 'yellow';
                } else if (foodForRender.upfAnalysis?.rating === NovaGroup.WHOLE_FOOD) {
                    classification = 'green';
                }

                return (
                    <FoodItemRow
                        key={`${foodForRender.fdcId}-${index}`}
                        food={foodForRender}
                        subDescription={`${item.quantity} x ${item.unit}`}
                        actions={
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveItem(index)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        }
                    >
                        <div className="flex items-center gap-1">
                           {foodForRender.glutenAnalysis?.isGlutenFree && <Badge variant="outline" className="text-[10px] px-1 py-0">GF</Badge>}
                           {classification && <UPFBadge classification={classification} showText={true} />}
                        </div>
                    </FoodItemRow>
                )
            })}
          </div>
        )}
      </div>
    </div>
  );
}
