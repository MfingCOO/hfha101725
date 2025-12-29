'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { hybridFoodSearch } from '@/app/coach/food-cache/actions';
import { FoodCacheModal } from '@/components/coach/food-cache/food-cache-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// SURGICAL INSERTION & REMOVAL: Import the shared type, remove the local one.
import { HybridFoodSearchResult } from '@/types';

interface ManageFoodCacheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageFoodCacheDialog({ open, onOpenChange }: ManageFoodCacheDialogProps) {
  const [query, setQuery] = useState('');
  // SURGICAL UPDATE: Use the imported shared type.
  const [searchResults, setSearchResults] = useState<HybridFoodSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedFdcId, setSelectedFdcId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');

  const performSearch = useCallback(async () => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const results = await hybridFoodSearch(query);
      setSearchResults(results);
    } catch (e) {
      setError('Failed to search for food items.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if(open) performSearch();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query, open, performSearch]);

  const handleOpenEditorModal = (fdcId: number) => {
    setSelectedFdcId(fdcId);
    setModalMode('edit');
    setIsEditorModalOpen(true);
  };

  const handleOpenCreatorModal = () => {
      setSelectedFdcId(null);
      setModalMode('create');
      setIsEditorModalOpen(true);
  }

  const handleCloseEditorModal = () => {
    setIsEditorModalOpen(false);
    setSelectedFdcId(null);
    performSearch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Food Cache</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search local cache or USDA database..."
            />
          </div>

          {isLoading && <p className='text-center py-4'>Searching...</p>}
          {error && <p className="text-destructive text-center py-4">{error}</p>}

          <div className="space-y-2 max-h-[50vh] overflow-y-auto p-1">
            {searchResults.map((food) => (
              <div key={food.fdcId} className="p-3 border rounded-lg flex justify-between items-center">
                <div className='max-w-prose'>
                  <p className="font-semibold">{food.description}</p>
                  <p className="text-sm text-muted-foreground">{food.brandOwner}</p>
                </div>
                <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                  {food.isCached && <span className="text-sm font-semibold text-green-500">In Cache</span>}
                  <Button 
                      variant={food.isCached ? 'secondary' : 'default'}
                      onClick={() => handleOpenEditorModal(food.fdcId)}>
                      {food.isCached ? 'Edit' : 'Add'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="secondary" onClick={handleOpenCreatorModal}>Create New Food</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isEditorModalOpen && (
        <FoodCacheModal 
          isOpen={isEditorModalOpen}
          onClose={handleCloseEditorModal}
          fdcId={selectedFdcId}
          mode={modalMode}
        />
      )}
    </>
  );
}
