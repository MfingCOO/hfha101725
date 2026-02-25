'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/components/auth/auth-provider';
import { z } from 'zod';
import { toast } from 'sonner';
import { type EnrichedFood, NovaGroup } from '@/types';
import { saveManualEnrichedFood, generateNewFdcId } from '@/app/coach/food-cache/actions';

import { BaseModal } from '@/components/ui/base-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { X } from 'lucide-react';

const FormSchema = z.object({
  description: z.string().min(1, 'Name is required'),
  brandOwner: z.string().optional(),
  servingSize: z.number().min(0, 'Serving size must be 0 or greater'),
  servingUnit: z.string(),
  calories: z.number().min(0, 'Calories must be 0 or greater'),
  protein: z.number().min(0, 'Protein must be 0 or greater'),
  carbs: z.number().min(0, 'Carbs must be 0 or greater'),
  fat: z.number().min(0, 'Fat must be 0 or greater'),
  sugar: z.number().min(0, 'Sugar must be 0 or greater'),
  fiber: z.number().min(0, 'Fiber must be 0 or greater'),
  ingredients: z.string().optional(),
  additionalPortions: z.array(z.object({
      description: z.string().min(1, 'Portion name is required'),
      gramWeight: z.number().positive('Portion weight must be positive'),
  })).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface CreateFoodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFoodFormModal({ isOpen, onClose }: CreateFoodFormModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      description: '',
      brandOwner: '',
      servingSize: 100,
      servingUnit: 'g',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugar: 0,
      fiber: 0,
      ingredients: '',
      additionalPortions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additionalPortions",
  });

  const onInvalid = (errors: FieldErrors) => {
    console.error("Form validation failed:", errors);
    toast.error(`Form is invalid. Check console for details.`);
  };

  const handleSave = async (data: FormValues) => {
    setIsSaving(true);
    
    try {
        const newId = await generateNewFdcId();
        const servingInGrams = data.servingUnit === 'oz' ? data.servingSize * 28.35 : data.servingSize;
        const ratio = servingInGrams > 0 ? 100 / servingInGrams : 0;

        const foodData: EnrichedFood = {
          fdcId: newId,
          description: data.description,
          brandOwner: data.brandOwner || '',
          ingredients: data.ingredients || '',
          source: 'USER_PROVIDED',
          analysisDate: new Date().toISOString(),
          upfAnalysis: {
            rating: NovaGroup.UNCLASSIFIED,
            justification: 'User-provided food, not analyzed.'
          },
          upfPercentage: {
            value: 0,
            justification: 'Not analyzed.'
          },
          glutenAnalysis: {
            isGlutenFree: false,
            justification: 'Not analyzed.'
          },
          nutrients: [
            { id: 1008, name: 'Energy', amount: data.calories * ratio, unitName: 'kcal' },
            { id: 1003, name: 'Protein', amount: data.protein * ratio, unitName: 'g' },
            { id: 1005, name: 'Carbohydrate, by difference', amount: data.carbs * ratio, unitName: 'g' },
            { id: 1004, name: 'Total lipid (fat)', amount: data.fat * ratio, unitName: 'g' },
            { id: 2000, name: 'Sugars, total including NLEA', amount: data.sugar * ratio, unitName: 'g' },
            { id: 1079, name: 'Fiber, total dietary', amount: data.fiber * ratio, unitName: 'g' },
          ],
          portionSizes: [
            { description: `Serving (${data.servingSize}${data.servingUnit})`, gramWeight: servingInGrams },
            ...(data.additionalPortions || []).filter(p => p.description && p.gramWeight > 0),
          ],
           // @ts-ignore
          status: 'pending_review',
        };

        if (!user) {
          toast.error("Authentication error. Please log in again.");
          setIsSaving(false);
          return;
      }
      const token = await user.getIdToken();
      const result = await saveManualEnrichedFood(foodData, token);      


        if (result.success) { // Note: we are also removing the check for 'result.food'
          toast.success('Custom food submitted for review!');
          form.reset();
          onClose();
        } else {
          toast.error(result.error || 'Failed to create custom food.');
        }
    } catch (e) {
        console.error(e);
        toast.error('An unexpected error occurred.');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Custom Food"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave, onInvalid)} className="space-y-4">
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <Label>Name *</Label>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="brandOwner" render={({ field }) => (
            <FormItem>
              <Label>Brand</Label>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )} />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="servingSize" render={({ field }) => (
                <FormItem>
                    <Label>Serving Size *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="servingUnit" render={({ field }) => (
                <FormItem>
                    <Label>Unit *</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="g">grams (g)</SelectItem>
                            <SelectItem value="oz">ounces (oz)</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
          </div>

          <p className="text-xs text-muted-foreground -mt-2">Enter nutrition info as it appears on the label for the serving size above.</p>

          <div className="grid grid-cols-3 gap-4">
             <FormField control={form.control} name="calories" render={({ field }) => (
                <FormItem>
                    <Label>Calories *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="protein" render={({ field }) => (
                <FormItem>
                    <Label>Protein (g) *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="carbs" render={({ field }) => (
                <FormItem>
                    <Label>Carbs (g) *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="fat" render={({ field }) => (
                <FormItem>
                    <Label>Fat (g) *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
             <FormField control={form.control} name="sugar" render={({ field }) => (
                <FormItem>
                    <Label>Sugar (g) *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="fiber" render={({ field }) => (
                <FormItem>
                    <Label>Fiber (g) *</Label>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
          </div>

          <FormField control={form.control} name="ingredients" render={({ field }) => (
              <FormItem>
                <Label>Ingredients</Label>
                <FormControl><Textarea {...field} /></FormControl>
              </FormItem>
          )} />

           <div>
                <Label className="mb-2 block">Additional Portions (Optional)</Label>
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2 mb-2">
                        <Input {...form.register(`additionalPortions.${index}.description`)} placeholder="e.g., 1 cup" className="flex-grow" />
                        <Input type="number" {...form.register(`additionalPortions.${index}.gramWeight`, { valueAsNumber: true })} placeholder="Weight" className="w-24" />
                        <span className="text-sm text-muted-foreground">g</span>
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><X className="h-4 w-4" /></Button>
                    </div>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', gramWeight: 0 })}>
                    + Add Portion
                </Button>
            </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Food'}</Button>
          </div>
        </form>
      </Form>
    </BaseModal>
  );
}
