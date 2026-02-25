'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { PlusCircle } from 'lucide-react';
import { type EnrichedFood, NovaGroup } from '@/types';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/auth-provider';
import { BaseModal } from '../ui/base-modal';
import { NutritionModal } from '../user/nutrition/nutrition-modal';
import { MealSummary } from './meal-summary';
import { Beef, Brain, Wheat, Sprout, ShieldAlert, UtensilsCrossed } from 'lucide-react';

interface ServingOption {
    label: string;
    grams: number;
}

interface UIFood {
    fdcId: number;
    description: string;
    brandOwner?: string;
    ingredients?: string;
    nutrients: Record<string, { value: number; unit: string; }>;
    servingOptions: ServingOption[];
    attributes?: { isGlutenFree: boolean; };
    isPreScaled?: boolean;
}

interface UIDetectUpfOutput {
    classification: 'green' | 'yellow' | 'red';
    reasoning: string;
    score: number;
}

export interface UIMealItem {
    food: UIFood;
    upf: UIDetectUpfOutput | null;
    quantity: number;
    unit: string;
}

const getClassificationFromNova = (novaGroup?: NovaGroup): 'red' | 'yellow' | 'green' => {
  switch (novaGroup) {
    case NovaGroup.UPF:
      return 'red';
    case NovaGroup.PROCESSED:
      return 'yellow';
    case NovaGroup.UNPROCESSED_OR_MINIMALLY_PROCESSED:
    case NovaGroup.PROCESSED_CULINARY_INGREDIENTS:
      return 'green';
    default:
      return 'green';
  }
};

export const adaptEnrichedFoodToUI = (data: Partial<EnrichedFood>): { food: UIFood; upf: UIDetectUpfOutput | null; } => {
    const foodData = data || {}; 
    const upfClassification = getClassificationFromNova(foodData.upfAnalysis?.rating);
    
    const upfOutput: UIDetectUpfOutput | null = foodData.upfAnalysis ? {
        classification: upfClassification,
        reasoning: foodData.upfAnalysis.justification || 'No reasoning provided.',
        score: foodData.upfPercentage?.value || 0,
    } : null;

    const nutrientsAsRecord: Record<string, { value: number; unit: string; }> = {};
    const rawNutrients = Array.isArray(foodData.nutrients) ? foodData.nutrients : [];

    rawNutrients.forEach(n => {
        if (n && n.name && n.name !== 'Energy') {
            nutrientsAsRecord[n.name] = { value: n.amount || 0, unit: n.unitName || '' };
        }
    });

    const energyKcal = rawNutrients.find(n => n.name === 'Energy' && n.unitName?.toUpperCase() === 'KCAL');
    const energyKj = rawNutrients.find(n => n.name === 'Energy' && n.unitName?.toUpperCase() === 'KJ');

    if (energyKcal) {
        nutrientsAsRecord['Energy'] = { value: energyKcal.amount || 0, unit: 'kcal' };
    } else if (energyKj) {
        nutrientsAsRecord['Energy'] = { value: (energyKj.amount || 0) / 4.184, unit: 'kcal' };
    }

    const servingOptionsData = (foodData as any).portionSizes || (foodData as any).servingOptions || [];
    const servingOptions = servingOptionsData.map((p: any) => ({
        label: p.description || 'Serving',
        grams: p.gramWeight || 100
    }));

    const isGlutenFree = foodData.glutenAnalysis?.isGlutenFree ?? false;

    return {
        upf: upfOutput,
        food: {
            fdcId: foodData.fdcId ?? 0,
            description: foodData.description ?? 'No Description',
            brandOwner: foodData.brandOwner,
            ingredients: foodData.ingredients,
            nutrients: nutrientsAsRecord,
            servingOptions: servingOptions,
            attributes: { isGlutenFree: isGlutenFree },
        },
    };
};

export const getNutrientsForServing = (food: UIFood, quantity: number, unitLabel: string) => {
    if (!food || !food.nutrients) {
        return {};
    }

    if (food.isPreScaled) {
        return food.nutrients;
    }
    const servingOptions = food.servingOptions || [];
    const servingGrams = servingOptions.find(opt => opt.label === unitLabel)?.grams || 100;
    const ratio = (servingGrams / 100) * quantity;

    const calculatedNutrients: Record<string, { value: number; unit: string; }> = {};
    Object.keys(food.nutrients).forEach(key => {
        calculatedNutrients[key] = { value: (food.nutrients[key]?.value || 0) * ratio, unit: food.nutrients[key]?.unit || '' };
    });
    return calculatedNutrients;
};

const hungerLevels = [
    { value: 0, label: '0 - Stuffed' }, { value: 1, label: '1 - Overly Full' }, { value: 2, label: '2 - Satiated' },
    { value: 3, label: '3 - Barely Satiated' }, { value: 4, label: '4 - Not Hungry, Not Full' }, { value: 5, label: '5 - Neutral' },
    { value: 6, label: '6 - Slightly Hungry' }, { value: 7, label: '7 - Hungry' }, { value: 8, label: '8 - Very Hungry' },
    { value: 9, label: '9 - Famished' }, { value: 10, label: '10 - Starving' }
];

const HungerScaleDropdown = ({ value, onValueChange, label }: { value: number, onValueChange: (v: number) => void, label: string }) => (
    <div className="space-y-1">
        <Label>{label}</Label>
        <Select value={String(value)} onValueChange={v => onValueChange(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>{hungerLevels.map(i => <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>)}</SelectContent>
        </Select>
    </div>
);

interface ContentProps { onFormStateChange: (newState: any) => void; formState?: any; }

export const NutritionContent = ({ onFormStateChange, formState }: ContentProps) => {
    const [upfReasoning, setUpfReasoning] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { user } = useAuth();
    const router = useRouter(); // DEFINITIVE FIX: Get router to force refresh

    const { mealType = 'snack', hungerBefore = 5, items = [] } = formState || {};

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value });
    };
    
    
    const handleAddItems = (itemsToAdd: any[]) => {
        if (!itemsToAdd || itemsToAdd.length === 0) {
            setIsSearchOpen(false);
            return;
        }

        const newUIMealItems = itemsToAdd.map(item => {
            const { food, upf } = adaptEnrichedFoodToUI(item);
            return {
                food: food,
                upf,
                quantity: item.quantity,
                unit: item.unit,
            };
        });        

        handleFieldChange('items', [...items, ...newUIMealItems]);
        setIsSearchOpen(false);
    };

    const handleRemoveMealItem = (index: number) => {
        handleFieldChange('items', items.filter((_: any, i: number) => i !== index));
    };
    
    const mealSummary = useMemo(() => {
        const totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, upfScore: 0, upfItems: 0 };
        const fullNutrientProfile: Record<string, { value: number; unit: string }> = {};

        items.forEach((item: UIMealItem) => {
            if (item.food && item.food.nutrients) {
                const allItemNutrients = getNutrientsForServing(item.food, item.quantity, item.unit);
                
                for (const key in allItemNutrients) {
                    const nutrient = allItemNutrients[key];
                    if (nutrient && typeof nutrient.value === 'number' && nutrient.unit) {
                        if (!fullNutrientProfile[key]) {
                            fullNutrientProfile[key] = { value: 0, unit: nutrient.unit };
                        }
                        fullNutrientProfile[key].value += nutrient.value;
                    }
                }
                
                totals.calories = fullNutrientProfile['Energy']?.value || 0;
                totals.protein = fullNutrientProfile['Protein']?.value || 0;
                totals.fat = fullNutrientProfile['Total lipid (fat)']?.value || 0;
                totals.carbs = fullNutrientProfile['Carbohydrate, by difference']?.value || 0;
                totals.fiber = fullNutrientProfile['Fiber, total dietary']?.value || 0;
        
                if (item.upf && typeof item.upf.score === 'number') {
                    totals.upfScore += item.upf.score;
                    totals.upfItems++;
                }
            }
        });
        
        const avgUpf = totals.upfItems > 0 ? totals.upfScore / totals.upfItems : 0;
        return { ...totals, avgUpf, fullNutrientProfile };
    }, [items]);

    
    React.useEffect(() => {
        // THIS IS THE FIX: This hook sends the 'mealSummary' object
        // to the parent component every time it's recalculated.
        onFormStateChange({ mealSummary: mealSummary });
    }, [mealSummary, onFormStateChange]);


    return (
        <>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <HungerScaleDropdown value={hungerBefore} onValueChange={v => handleFieldChange('hungerBefore', v)} label="Hunger Before" />
                    <div className="space-y-1">
                        <Label>Meal Type</Label>
                        <Select value={mealType} onValueChange={v => handleFieldChange('mealType', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="breakfast">Breakfast</SelectItem>
                                <SelectItem value="lunch">Lunch</SelectItem>
                                <SelectItem value="dinner">Dinner</SelectItem>
                                <SelectItem value="snack">Snack</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="grid grid-cols-6 gap-1 text-center p-2 rounded-lg bg-muted/50">
                    {[{i:UtensilsCrossed,c:'amber',l:'kcal',v:mealSummary.calories,f:0},{i:Beef,c:'red',l:'Protein',v:mealSummary.protein,f:0,u:'g'},{i:Brain,c:'blue',l:'Fat',v:mealSummary.fat,f:0,u:'g'},{i:Wheat,c:'orange',l:'Carbs',v:mealSummary.carbs,f:0,u:'g'},{i:Sprout,c:'green',l:'Fiber',v:mealSummary.fiber,f:1,u:'g'},{i:ShieldAlert,c:'red',l:'UPF',v:mealSummary.avgUpf,f:0,u:'%'}].map(m=>(                        <div className="flex flex-col items-center justify-center" key={m.l}>
                            <m.i className={cn(`h-4 w-4 text-${m.c}-400`)} />
                            <span className="text-sm font-bold">{m.v.toFixed(m.f)}{m.u || ''}</span>
                            <span className="text-[10px] text-muted-foreground -mt-1">{m.l}</span>
                        </div>
                    ))}
                </div>
                <MealSummary items={items} onRemove={handleRemoveMealItem} onReasoningClick={r => setUpfReasoning(r)} />
                <Button variant="outline" className="w-full" onClick={() => setIsSearchOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Food to Meal
                </Button>
            </div>

            {isSearchOpen && user && (
                <NutritionModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onAddItems={handleAddItems}
                    userId={user.uid}
                />
            )}

            {upfReasoning && (
                <BaseModal isOpen={!!upfReasoning} onClose={() => setUpfReasoning(null)} title="UPF Reasoning" description="Here's why this food received its rating:">
                    <p className="text-sm">{upfReasoning}</p>
                    <div className="pt-4 flex justify-end"><Button onClick={() => setUpfReasoning(null)}>Close</Button></div>
                </BaseModal>
            )}
        </>
    );
};