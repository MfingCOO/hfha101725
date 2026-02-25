'use client';

import * as React from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Trash2, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import type { UIMealItem } from './nutrition-content';
import { getNutrientsForServing } from './nutrition-content';

const UPF_CLASSES = {
    green: 'border-green-500/40 bg-green-500/20 text-green-300',
    yellow: 'border-yellow-500/40 bg-yellow-500/20 text-yellow-300',
    red: 'border-red-500/40 bg-red-500/20 text-red-300',
};

const NutrientDisplay = ({ label, value, unit, className }: { label: string, value: number, unit: string, className?: string }) => (
    <div className={cn("text-center", className)}>
        <p className="font-bold text-sm">{value.toFixed(0)}</p>
        <p className="text-xs text-muted-foreground -mt-1">{label}</p>
    </div>
);

const MealItemRow = ({ item, onRemove, onReasoningClick }: { item: UIMealItem, onRemove: () => void, onReasoningClick: (reasoning: string) => void }) => {
    // SIMPLIFIED LOGIC: No more backward compatibility. Only process the new format.
    const nutrients = getNutrientsForServing(item.food, item.quantity, item.unit);
    const upfClass = item.upf ? UPF_CLASSES[item.upf.classification] : '';
    const upfLabel = item.upf?.classification === 'red' ? 'UPF' : item.upf?.classification === 'yellow' ? 'Processed' : 'Whole Food';

    return (
        <div className="bg-muted/30 p-2 rounded-lg">
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <p className="font-semibold text-sm leading-tight">{item.food.description}</p>
                    <p className="text-xs text-muted-foreground">{`${item.quantity} x ${item.unit}`}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    {item.food.attributes?.isGlutenFree && <Badge variant="outline" className="text-[10px] px-1 py-0">GF</Badge>}
                    {item.upf && (
                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0", upfClass)}>{upfLabel}</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-2 items-center">
                <NutrientDisplay label="kcal" value={nutrients['Energy']?.value || 0} unit="" />
                <NutrientDisplay label="Protein" value={nutrients['Protein']?.value || 0} unit="g" />
                <NutrientDisplay label="Fat" value={nutrients['Total lipid (fat)']?.value || 0} unit="g" />
                <NutrientDisplay label="Carbs" value={nutrients['Carbohydrate, by difference']?.value || 0} unit="g" />
                {item.upf?.reasoning ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 mx-auto" onClick={() => onReasoningClick(item.upf!.reasoning)}>
                        <Info className="h-4 w-4 text-blue-400" />
                    </Button>
                ) : <div />}
            </div>
        </div>
    );
};


export const MealSummary = ({ items, onRemove, onReasoningClick }: { items: UIMealItem[], onRemove: (index: number) => void, onReasoningClick: (reasoning: string) => void }) => {

    if (items.length === 0) {
        return (
            <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Your meal is empty.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Meal Items</p>
            <ScrollArea className="h-[250px] pr-3">
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <MealItemRow 
                            key={index} 
                            item={item} 
                            onRemove={() => onRemove(index)} 
                            onReasoningClick={onReasoningClick} 
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};