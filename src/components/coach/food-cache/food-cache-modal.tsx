'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEnrichedFood, deleteFoodFromCache, hybridFoodSearch } from '@/app/coach/food-cache/actions';
import { EnrichedFood, NovaGroup } from '@/types';
import { toast } from 'sonner';

interface FoodCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  fdcId?: number | null; // Restored
  mode?: "create" | "edit"; // Restored
  isCoach?: boolean; // Restored
  user?: any; // Restored
}

export function FoodCacheModal({ isOpen, onClose, fdcId, mode }: FoodCacheModalProps) {
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && fdcId) {
      handleLoadFood(fdcId);
    }
  }, [isOpen, fdcId]);

  async function handleLoadFood(id: number | string) {
    setLoading(true);
    const result = await getEnrichedFood(id);
    if (result.success) setSelectedFood(result.data);
    setLoading(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Cache' : 'Food Details'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
          ) : selectedFood ? (
            <div>
               <h2 className="text-xl font-bold">{selectedFood.description}</h2>
               <p>NOVA Group: {selectedFood.upfAnalysis?.rating}</p>
               {/* Simplified UI to ensure stability */}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Select a food to view details.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}