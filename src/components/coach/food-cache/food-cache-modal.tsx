import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, useWatch, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EnrichedFood, PortionSize, NovaGroup, Nutrient } from '@/types';
import { getEnrichedFood, saveManualEnrichedFood, getFoodDetails, deleteFoodFromCache } from '@/app/coach/food-cache/actions';
import { z } from 'zod';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormItem, FormControl } from '@/components/ui/form';

// DEFINITIVE FIX: Schema is now synced with EnrichedFoodSchema from types/index.ts
const FormSchema = z.object({
  fdcId: z.number(),
  description: z.string().min(1, 'Description is required'),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
  source: z.enum(['AI_ANALYSIS', 'USER_PROVIDED']),
  analysisDate: z.string(), // Required
  upfAnalysis: z.object({
    rating: z.nativeEnum(NovaGroup),
    justification: z.string(), // Required
  }),
  glutenAnalysis: z.object({
    isGlutenFree: z.boolean(),
    justification: z.string(), // Required
  }),
  upfPercentage: z.object({
      value: z.number().min(0).max(100),
      justification: z.string(), // Required
  }),
  portionSizes: z.array(z.object({
      description: z.string().min(1, 'Description is required'),
      gramWeight: z.number().positive('Gram weight must be positive'),
  })),
  nutrients: z.array(z.object({
    id: z.number().optional(),
    name: z.string(),
    amount: z.number(), // Required
    unitName: z.string(),
  })),
});

type FormValues = z.infer<typeof FormSchema>;

interface FoodCacheModalProps {
  isOpen: boolean;
  onClose: (update: { fdcId: number } | null) => void;
  fdcId: number | null;
}

export const FoodCacheModal: React.FC<FoodCacheModalProps> = ({ isOpen, onClose, fdcId }) => {
  const roundNutrientAmounts = (nutrients: any[] | undefined) => {
      if (!nutrients) return [];
      return nutrients.map(n => ({
        ...n,
        amount: Math.round((n.amount || 0) * 10) / 10
      }));
  };
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    // DEFINITIVE FIX: Provide a complete set of default values to prevent type inference issues.
    defaultValues: {
        fdcId: 0,
        description: '',
        brandOwner: '',
        ingredients: '',
        source: 'USER_PROVIDED',
        analysisDate: new Date().toISOString(),
        upfAnalysis: { rating: NovaGroup.WHOLE_FOOD, justification: '' },
        glutenAnalysis: { isGlutenFree: false, justification: '' },
        upfPercentage: { value: 0, justification: '' },
        portionSizes: [],
        nutrients: [],
      },
  });

  const { control, register, handleSubmit, reset, setValue, getValues } = form;
  const nutrients = useWatch({ control, name: 'nutrients' }) || [];
  const { fields, append, remove } = useFieldArray({ control, name: "portionSizes" });

  const upfPercentageValue = useWatch({ control, name: 'upfPercentage.value' });

  useEffect(() => {
    const percentage = upfPercentageValue;
    if (typeof percentage !== 'number' || isNaN(percentage)) return;

    let newNovaGroup: NovaGroup;
    if (percentage <= 10) {
      newNovaGroup = NovaGroup.WHOLE_FOOD;
    } else if (percentage <= 20) {
      newNovaGroup = NovaGroup.PROCESSED;
    } else {
      newNovaGroup = NovaGroup.UPF;
    }

    if (getValues('upfAnalysis.rating') !== newNovaGroup) {
      setValue('upfAnalysis.rating', newNovaGroup, { shouldDirty: true });
    }
  }, [upfPercentageValue, setValue, getValues]);


  const loadFoodData = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const existingFood = await getEnrichedFood(id);
      if (existingFood) {
        const foodToReset = {
            ...existingFood,
            // THE GUARANTEED FIX: Deeply check and provide defaults for all nested form fields.
            upfAnalysis: {
                rating: existingFood.upfAnalysis?.rating || NovaGroup.UNCLASSIFIED,
                justification: existingFood.upfAnalysis?.justification || '',
            },
            glutenAnalysis: {
                isGlutenFree: existingFood.glutenAnalysis?.isGlutenFree || false,
                justification: existingFood.glutenAnalysis?.justification || '',
            },
            upfPercentage: {
                value: existingFood.upfPercentage?.value || 0,
                justification: existingFood.upfPercentage?.justification || '',
            },
            // Also ensure top-level optional fields are not null/undefined.
            brandOwner: existingFood.brandOwner || '',
            ingredients: existingFood.ingredients || '',
            nutrients: roundNutrientAmounts(existingFood.nutrients),
            portionSizes: existingFood.portionSizes || [], // Ensure portionSizes is always an array.
        };
        reset(foodToReset); // This object is now guaranteed to be 100% schema-compliant.
      } else {
        const usdaDetails = await getFoodDetails(id);
        if (usdaDetails) {
            reset({
                fdcId: id,
                description: usdaDetails.description,
                brandOwner: '',
                ingredients: usdaDetails.ingredients || '',
                nutrients: roundNutrientAmounts(usdaDetails.nutrients),
                source: 'USER_PROVIDED',
                analysisDate: new Date().toISOString(),
                upfAnalysis: { rating: NovaGroup.WHOLE_FOOD, justification: '' },
                glutenAnalysis: { isGlutenFree: false, justification: '' },
                upfPercentage: { value: 0, justification: '' },
                portionSizes: [{ description: '100g', gramWeight: 100 }],
            });
        }
      }
    } catch (e) {
      setError('Failed to load food data.');
    } finally {
      setIsLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (isOpen && fdcId) {
      loadFoodData(fdcId);
    } else if (!isOpen) {
      reset();
      setError(null);
    }
  }, [isOpen, fdcId, loadFoodData, reset]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      // DEFINITIVE FIX: No more `as any`. The data now correctly matches the EnrichedFood type.
      const result = await saveManualEnrichedFood(data);
      if (result.success) {
        toast.success('Food item saved successfully!');
        onClose({ fdcId: data.fdcId });
      } else {
        setError(result.error || 'Save failed. Please check the fields.');
      }
    } catch (e) {
      setError('A server error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!fdcId) return;
    if (!window.confirm('Are you sure you want to permanently delete this item from the cache?')) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await deleteFoodFromCache(fdcId);
      if (result.success) {
        toast.success('Food item deleted successfully!');
        onClose({ fdcId }); // Triggers a refresh in the parent
      } else {
        setError(result.error || 'Deletion failed. Please try again.');
      }
    } catch (e) {
        setError('A server error occurred during deletion. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  const onInvalid = (errors: FieldErrors) => {
    console.error("Form validation failed:", errors);
    setError(`Form is invalid. See console for details.`);
  };
  
  const renderNutrientInput = (nutrientName: string, label: string, unit: string) => {
      const nutrientIndex = nutrients.findIndex((n: any) => n.name.toLowerCase() === nutrientName.toLowerCase());
      if (nutrientIndex === -1) return null;

      return (
          <div className="space-y-2 text-center">
              <Label htmlFor={`nutrient-${nutrientIndex}`}>{label}</Label>
              <div className="flex items-center justify-center">
                  <Input
                      id={`nutrient-${nutrientIndex}`}
                      type="number"
                      step={label === 'Calories' ? "1" : "0.1"}
                      className="text-center p-1 h-9"
                      {...register(`nutrients.${nutrientIndex}.amount`, { valueAsNumber: true })}
                  />
                  <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
              </div>
          </div>
      );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Food Cache Management</DialogTitle>
          <DialogDescription>
             View, edit, and analyze all nutritional information for this food item.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && <p className="text-center py-12">Loading...</p>}
        {error && <p className="text-destructive p-3 rounded-md my-4 text-sm text-center">{error}</p>}

        {!isLoading && fdcId && (
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex-1 flex flex-col overflow-hidden gap-4">
            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-1"><Label htmlFor="fdcId">FDC ID</Label><Input id="fdcId" {...register('fdcId', { valueAsNumber: true })} readOnly /></div>
                    <div className="space-y-2 col-span-2"><Label htmlFor="description">Description</Label><Input id="description" {...register('description')} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="brandOwner">Brand Owner</Label><Input id="brandOwner" {...register('brandOwner')} /></div>
                <div className="space-y-2"><Label htmlFor="ingredients">Ingredients</Label><Textarea id="ingredients" {...register('ingredients')} rows={3} /></div>

                <div className="p-4 border rounded-md">
                    <h3 className="text-lg font-semibold mb-3">Nutritional Information (per 100g)</h3>
                    {nutrients.length > 0 ? (
                        <>
                            <div className="grid grid-cols-5 gap-3 mb-4">
                                {renderNutrientInput('Energy', 'Calories', 'kcal')}
                                {renderNutrientInput('Protein', 'Protein', 'g')}
                                {renderNutrientInput('Total lipid (fat)', 'Fat', 'g')}
                                {renderNutrientInput('Carbohydrate, by difference', 'Carbs', 'g')}
                                {renderNutrientInput('Fiber, total dietary', 'Fiber', 'g')}
                            </div>
                            <details><summary className="cursor-pointer text-sm">Toggle Full Nutrition Details</summary>
                                <div className="mt-2 p-2 bg-muted/50 rounded-md max-h-32 overflow-y-auto text-xs">
                                    {nutrients.map((n: any) => (<div key={n.id || n.name} className="flex justify-between"><span>{n.name}</span><span>{(n.amount || 0).toFixed(1)}{n.unitName}</span></div>))}
                                </div>
                            </details>
                        </>
                    ) : (
                        <div className="text-center py-4 text-muted-foreground">Loading nutritional data...</div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-md space-y-3">
                        <h3 className="text-lg font-semibold">UPF Analysis</h3>
                         <div className="space-y-2"><Label htmlFor="upfPercentage">UPF Percentage</Label><Input id="upfPercentage" type="number" {...register('upfPercentage.value', { valueAsNumber: true })} /></div>
                        <div className="space-y-2">
                            <Label>NOVA Group</Label>
                            <FormField control={control} name="upfAnalysis.rating" render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{Object.values(NovaGroup).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                </Select>
                            )}/>
                        </div>
                         <div className="space-y-2"><Label htmlFor="upfJustification">Justification</Label><Textarea id="upfJustification" {...register('upfAnalysis.justification')} rows={2} /></div>
                    </div>
                    <div className="p-4 border rounded-md space-y-3">
                        <h3 className="text-lg font-semibold">Gluten Analysis</h3>
                        <FormField control={control} name="glutenAnalysis.isGlutenFree" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 pt-2"><FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="glutenValue" />
                                </FormControl><Label htmlFor="glutenValue" className="!mt-0 font-normal">Gluten Free</Label></FormItem>
                        )} />
                        <div className="space-y-2"><Label htmlFor="glutenJustification">Justification</Label><Textarea id="glutenJustification" {...register('glutenAnalysis.justification')} rows={4} /></div>
                    </div>
                </div>
                
                <div className="p-4 border rounded-md">
                  <h3 className="text-lg font-semibold mb-4">Portion Sizes</h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                      {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                              <Input {...register(`portionSizes.${index}.description`)} placeholder="e.g., 1 cup" className="col-span-7"/>
                              <Input type="number" {...register(`portionSizes.${index}.gramWeight`, { valueAsNumber: true })} placeholder="Grams" className="col-span-3"/>
                              <Button type="button" variant="destructive" onClick={() => remove(index)} className="col-span-2">X</Button>
                          </div>
                      ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', gramWeight: 0 })} className="mt-3"> + Add Portion</Button>
                </div>
            </div>
            <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => onClose(null)} className="mr-auto">Cancel</Button>
                <Button type="button" variant="destructive" disabled={isLoading} onClick={handleDelete}>Delete</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};