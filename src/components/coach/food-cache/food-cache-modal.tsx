'use client';
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getEnrichedFood, getFoodDetails, saveManualEnrichedFood, generateNewFdcId, deleteFoodFromCache } from '@/app/coach/food-cache/actions';
import { type EnrichedFood, type Nutrient, type PortionSize, NovaGroup } from '@/types/nutrition';
import { BaseModal } from '@/components/ui/base-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { User } from 'firebase/auth';

const FormSchema = z.object({
  fdcId: z.number(),
  description: z.string().min(1, 'Description is required'),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
  servingSize: z.number().min(0, 'Serving size must be positive'),
  servingUnit: z.string(),
  nutrients: z.array(z.object({
    id: z.number(),
    name: z.string(),
    amount: z.number(),
    unitName: z.string(),
  })),
  upfAnalysis: z.object({
      rating: z.nativeEnum(NovaGroup),
      justification: z.string().optional(),
  }),
  isGlutenFree: z.boolean(),
  glutenJustification: z.string().optional(),
  upfPercentage: z.number().min(0).max(100),
  upfJustification: z.string().optional(),
  additionalPortions: z.array(z.object({
      description: z.string().min(1, 'Portion description is required'),
      gramWeight: z.number().positive('Gram weight must be positive'),
  }))
});

type FormValues = z.infer<typeof FormSchema>;

interface FoodCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  fdcId?: number | null;
  mode: 'create' | 'edit';
  isCoach: boolean;
  user: User | null;
}

export function FoodCacheModal({ isOpen, onClose, fdcId, mode, isCoach, user }: FoodCacheModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      description: '',
      brandOwner: '',
      ingredients: '',
      servingSize: 100,
      servingUnit: 'g',
      nutrients: [],
      upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: '' },
      isGlutenFree: false,
      glutenJustification: '',
      upfPercentage: 0,
      upfJustification: '',
      additionalPortions: []
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "additionalPortions"
  });

  useEffect(() => {
    const loadFoodData = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      setError(null);
      
      if (mode === 'edit' && fdcId) {
        const response = await getEnrichedFood(fdcId);
        let foodData: EnrichedFood | null = null;

        if (response.success && response.data) {
            foodData = response.data;
        } else {
          const usdaData = await getFoodDetails(fdcId);
          if (usdaData) {
            foodData = { ...usdaData, source: 'USER_PROVIDED', analysisDate: new Date().toISOString(), upfAnalysis: {rating: NovaGroup.UNCLASSIFIED, justification: ''}, upfPercentage: {value: 0, justification: ''}, glutenAnalysis: {isGlutenFree: false, justification: ''}, portionSizes: [] };
          } else {
            setError(response.error || 'Food not found.');
            setIsLoading(false);
            return;
          }
        }

        form.reset({
          fdcId: foodData.fdcId,
          description: foodData.description,
          brandOwner: foodData.brandOwner || '',
          ingredients: foodData.ingredients || '',
          servingSize: 100, 
          servingUnit: 'g',
          nutrients: foodData.nutrients,
          upfAnalysis: foodData.upfAnalysis || { rating: NovaGroup.UNCLASSIFIED, justification: '' },
          isGlutenFree: foodData.glutenAnalysis?.isGlutenFree || false,
          glutenJustification: foodData.glutenAnalysis?.justification || '',
          upfPercentage: foodData.upfPercentage?.value || 0,
          upfJustification: foodData.upfPercentage?.justification || '',
          additionalPortions: foodData.portionSizes || []
        });

      } else if (mode === 'create') {
        const newFdcId = await generateNewFdcId();
        form.reset({
          fdcId: newFdcId,
          description: '',
          brandOwner: '',
          ingredients: '',
          servingSize: 100,
          servingUnit: 'g',
          nutrients: [
            { id: 1008, name: 'Energy', amount: 0, unitName: 'kcal' },
            { id: 1003, name: 'Protein', amount: 0, unitName: 'g' },
            { id: 1004, name: 'Fat', amount: 0, unitName: 'g' },
            { id: 1005, name: 'Carbs', amount: 0, unitName: 'g' },
          ],
          upfAnalysis: { rating: NovaGroup.UNCLASSIFIED, justification: '' },
          isGlutenFree: false,
          glutenJustification: '',
          upfPercentage: 0,
          upfJustification: '',
          additionalPortions: []
        });
      }
      setIsLoading(false);
    };
    loadFoodData();
  }, [isOpen, fdcId, mode, form]);

  const handleSave = async (data: FormValues) => {
    setIsSaving(true);
    if (!user) {
      toast.error("Authentication error. Please log in again.");
      setIsSaving(false);
      return;
    }
    
    const servingInGrams = data.servingUnit === 'oz' ? data.servingSize * 28.35 : data.servingSize;
    const ratio = servingInGrams > 0 ? 100 / servingInGrams : 1;

    const finalNutrients: Nutrient[] = data.nutrients.map(n => ({...n, amount: (n.amount || 0) * ratio }));
    
    const enrichedFood: EnrichedFood = {
      fdcId: data.fdcId,
      description: data.description,
      brandOwner: data.brandOwner,
      ingredients: data.ingredients,
      source: isCoach ? 'MANUAL_BULK' : 'USER_PROVIDED',
      analysisDate: new Date().toISOString(),
      nutrients: finalNutrients,
      upfAnalysis: {
        rating: data.upfAnalysis.rating,
        justification: data.upfAnalysis.justification || '',
      },
      glutenAnalysis: {
        isGlutenFree: data.isGlutenFree,
        justification: data.glutenJustification || '',
      },
      upfPercentage: {
        value: data.upfPercentage,
        justification: data.upfJustification || '',
      },
      portionSizes: data.additionalPortions,
    };
    
    try {
      const token = await user.getIdToken();
      const result = await saveManualEnrichedFood(enrichedFood, token);
      if (result.success) {
        toast.success(`Food ${mode === 'create' ? 'created' : 'updated'} successfully.`);
        onClose();
      } else {
        toast.error(result.error || 'Failed to save food.');
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred during save.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!fdcId) return;
    setIsDeleting(true);
    try {
        const result = await deleteFoodFromCache(fdcId);
        if (result.success) {
            toast.success('Food item deleted successfully.');
            onClose();
        } else {
            toast.error(result.error || 'Failed to delete food item.');
        }
    } catch (e) {
        toast.error('An unexpected error occurred during deletion.');
    } finally {
        setIsDeleting(false);
    }
  }

  const FooterContent = () => (
    <div className="flex justify-between items-center w-full">
        <div>
            {mode === 'edit' && fdcId && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete Food'}
                </Button>
            )}
        </div>
        <div className="flex items-center space-x-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create New Food' : 'Edit Food'}
      className="max-w-4xl h-[85vh]"
      footer={<FooterContent />}
    >
      {isLoading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <Label>Description</Label>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="brandOwner" render={({ field }) => (
                  <FormItem>
                    <Label>Brand Owner</Label>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ingredients" render={({ field }) => (
                <FormItem>
                    <Label>Ingredients</Label>
                    <FormControl><Textarea {...field} /></FormControl>
                </FormItem>
            )} />
            <div className="border p-4 rounded-md space-y-4">
                <h3 className="font-semibold">Nutrition - Per 100g</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(form.getValues('nutrients') || []).map((nutrient, index) => (
                        <FormField key={nutrient.id} control={form.control} name={`nutrients.${index}.amount`} render={({ field }) => (
                            <FormItem>
                                <Label>{nutrient.name}</Label>
                                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                            </FormItem>
                        )} />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border p-4 rounded-md space-y-4">
                    <h3 className="font-semibold">UPF Analysis</h3>
                     <FormField control={form.control} name="upfAnalysis.rating" render={({ field }) => (
                        <FormItem>
                            <Label>NOVA Group</Label>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>
                                    {Object.values(NovaGroup).map(group => (
                                        <SelectItem key={group} value={group}>{group}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="upfAnalysis.justification" render={({ field }) => (
                        <FormItem>
                            <Label>Justification</Label>
                            <FormControl><Textarea {...field} /></FormControl>
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="upfPercentage" render={({ field }) => (
                        <FormItem>
                            <Label>UPF Percentage</Label>
                            <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="upfJustification" render={({ field }) => (
                        <FormItem>
                            <Label>UPF % Justification</Label>
                            <FormControl><Textarea {...field} /></FormControl>
                        </FormItem>
                    )} />
                </div>
                <div className="border p-4 rounded-md space-y-4">
                    <h3 className="font-semibold">Gluten Analysis</h3>
                    <FormField control={form.control} name="isGlutenFree" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <Label>Is Gluten Free?</Label>
                            <FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="glutenJustification" render={({ field }) => (
                        <FormItem>
                            <Label>Justification</Label>
                            <FormControl><Textarea {...field} /></FormControl>
                        </FormItem>
                    )} />
                </div>
            </div>

            <div className="border p-4 rounded-md space-y-4">
              <h3 className="font-semibold">Portion Sizes</h3>
                {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <FormField control={form.control} name={`additionalPortions.${index}.description`} render={({ field }) => <Input {...field} placeholder="Portion Description" />} />
                      <FormField control={form.control} name={`additionalPortions.${index}.gramWeight`} render={({ field }) => <Input type="number" {...field} placeholder="Weight (g)" onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                      <Button type="button" variant="destructive" onClick={() => remove(index)}>Remove</Button>
                    </div>
                ))}
              <Button type="button" onClick={() => append({ description: '', gramWeight: 0 })}>Add Portion</Button>
             </div>
          </form>
        </Form>
      )}
    </BaseModal>
  );
}
