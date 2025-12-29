'use client';

import { useState, FC } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const initialFormData = {
  foodName: '',
  brand: '',
  servingSize: '',
  servingSizeUnit: 'g',
  calories: '',
  protein: '',
  carbohydrates: '',
  fat: '',
  ingredients: '',
  isGlutenFree: false,
  upfPercentage: '',
  upfRanking: '',
  micronutrients: {},
};

interface CreateFoodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateFoodFormModal: FC<CreateFoodFormModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('micronutrients.')) {
        const microName = name.split('.')[1];
        setFormData(prev => ({ 
            ...prev, 
            micronutrients: { ...prev.micronutrients, [microName]: value } 
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setMessage(null);

    if (!user) {
      setMessage({ type: 'error', text: 'Authentication failed.' });
      setIsLoading(false);
      return;
    }

    const payload: { [key: string]: any } = {
      ...formData,
      servingSize: parseFloat(formData.servingSize) || 0,
      calories: parseFloat(formData.calories) || 0,
      protein: parseFloat(formData.protein) || 0,
      carbohydrates: parseFloat(formData.carbohydrates) || 0,
      fat: parseFloat(formData.fat) || 0,
      upfPercentage: formData.upfPercentage ? parseFloat(formData.upfPercentage) : undefined,
      micronutrients: Object.fromEntries(
        Object.entries(formData.micronutrients).map(([key, value]) => [key, parseFloat(value as string) || 0])
      ),
    };

    // Remove fields that shouldn't be sent if they are empty
    if (!payload.upfRanking) delete payload.upfRanking;
    if (Object.keys(payload.micronutrients).length === 0) delete payload.micronutrients;


    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/coach/create-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');

      setMessage({ type: 'success', text: `Successfully created: ${formData.foodName}` });
      setFormData(initialFormData);

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setMessage(null);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a New Custom Food</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">

          {/* --- CORE FIELDS --- */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="foodName" className="text-right">Name *</Label>
            <Input id="foodName" name="foodName" value={formData.foodName} onChange={handleChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="brand" className="text-right">Brand</Label>
            <Input id="brand" name="brand" value={formData.brand} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="servingSize" className="text-right">Serving Size *</Label>
            <Input id="servingSize" name="servingSize" type="number" value={formData.servingSize} onChange={handleChange} className="col-span-3" required/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="servingSizeUnit" className="text-right">Unit *</Label>
            <Select onValueChange={(v) => handleSelectChange('servingSizeUnit', v)} defaultValue={formData.servingSizeUnit}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="g">grams (g)</SelectItem>
                    <SelectItem value="ml">milliliters (ml)</SelectItem>
                    <SelectItem value="oz">ounces (oz)</SelectItem>
                    <SelectItem value="fl oz">fluid ounces (fl oz)</SelectItem>
                    <SelectItem value="each">each</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="calories" className="text-right">Calories *</Label>
            <Input id="calories" name="calories" type="number" value={formData.calories} onChange={handleChange} className="col-span-3" required/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="protein" className="text-right">Protein (g) *</Label>
            <Input id="protein" name="protein" type="number" value={formData.protein} onChange={handleChange} className="col-span-3" required/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="carbohydrates" className="text-right">Carbs (g) *</Label>
            <Input id="carbohydrates" name="carbohydrates" type="number" value={formData.carbohydrates} onChange={handleChange} className="col-span-3" required/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fat" className="text-right">Fat (g) *</Label>
            <Input id="fat" name="fat" type="number" value={formData.fat} onChange={handleChange} className="col-span-3" required/>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ingredients" className="text-right">Ingredients</Label>
            <Input id="ingredients" name="ingredients" value={formData.ingredients} onChange={handleChange} className="col-span-3" />
          </div>

          {/* --- NEW PROCESSING & DIETARY FIELDS --- */}
          <div className="items-center gap-4 flex">
            <Checkbox id="isGlutenFree" name="isGlutenFree" checked={formData.isGlutenFree} onCheckedChange={(c) => setFormData(p => ({...p, isGlutenFree: c as boolean}))} />
            <Label htmlFor="isGlutenFree" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Gluten-Free</Label>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="upfRanking" className="text-right">Processing</Label>
            <Select onValueChange={(v) => handleSelectChange('upfRanking', v)} value={formData.upfRanking}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select ranking..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="whole_food">Whole Food</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="UPF">Ultra-Processed (UPF)</SelectItem>
                </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="upfPercentage" className="text-right">UPF %</Label>
            <Input id="upfPercentage" name="upfPercentage" type="number" value={formData.upfPercentage} onChange={handleChange} className="col-span-3" />
          </div>

          {/* --- MICRONUTRIENTS ACCORDION --- */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Optional: Add Micronutrients</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="micronutrients.vitaminA" className="text-right text-xs">Vitamin A (mcg)</Label>
                    <Input id="micronutrients.vitaminA" name="micronutrients.vitaminA" type="number" onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="micronutrients.vitaminC" className="text-right text-xs">Vitamin C (mg)</Label>
                    <Input id="micronutrients.vitaminC" name="micronutrients.vitaminC" type="number" onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="micronutrients.iron" className="text-right text-xs">Iron (mg)</Label>
                    <Input id="micronutrients.iron" name="micronutrients.iron" type="number" onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="micronutrients.calcium" className="text-right text-xs">Calcium (mg)</Label>
                    <Input id="micronutrients.calcium" name="micronutrients.calcium" type="number" onChange={handleChange} className="col-span-3" />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

        </div>
        <DialogFooter>
          {message && <p className={`${message.type === 'success' ? 'text-green-600' : 'text-red-600'} text-sm`}>{message.text}</p>}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? 'Creating...' : 'Save Food'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
