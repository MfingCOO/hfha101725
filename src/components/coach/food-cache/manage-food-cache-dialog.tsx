'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { searchUSDA, checkCachedStatus } from '@/app/coach/food-cache/actions';
import { FoodCacheModal } from '@/components/coach/food-cache/food-cache-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnrichedFood } from '@/types';

// This interface defines the strict shape of a search result on the client.
interface SearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
}

interface ManageFoodCacheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageFoodCacheDialog({ open, onOpenChange }: ManageFoodCacheDialogProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedIds, setCachedIds] = useState<Set<number>>(new Set());
  
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedFdcId, setSelectedFdcId] = useState<number | null>(null);

  const performSearch = useCallback(async () => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchUSDA(query);
      
      const validResults = results.filter(
        (item): item is SearchResult => 
          item != null && 
          typeof item.fdcId === 'number' && 
          typeof item.description === 'string'
      );
      setSearchResults(validResults);

      if (validResults.length > 0) {
        const fdcIds = validResults.map(r => r.fdcId);
        const cached = await checkCachedStatus(fdcIds);
        setCachedIds(new Set(cached));
      } else {
        setCachedIds(new Set());
      }
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
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query, open, performSearch]);

  const handleOpenEditorModal = (fdcId: number) => {
    setSelectedFdcId(fdcId);
    setIsEditorModalOpen(true);
  };

  const handleCloseEditorModal = (update: (EnrichedFood & { fdcId: number }) | { fdcId: number } | null) => {
    setIsEditorModalOpen(false);
    setSelectedFdcId(null);

    if (update) {
      if (!('description' in update)) {
        setSearchResults(prev => prev.filter(item => item.fdcId !== update.fdcId));
        setCachedIds(prev => {
          const newIds = new Set(prev);
          newIds.delete(update.fdcId);
          return newIds;
        });
      } else {
        setSearchResults(prev => 
          prev.map(item => 
            item.fdcId === update.fdcId
              ? { ...item, description: update.description, brandOwner: update.brandOwner }
              : item
          )
        );
        setCachedIds(prev => new Set(prev).add(update.fdcId));
      }
    }
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
              placeholder="Search for a food item in USDA database..."
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
                  {cachedIds.has(food.fdcId) && <span className="text-sm font-semibold text-green-500">Cached</span>}
                  <Button 
                      variant={cachedIds.has(food.fdcId) ? 'secondary' : 'default'}
                      onClick={() => handleOpenEditorModal(food.fdcId)}>
                      {cachedIds.has(food.fdcId) ? 'Edit' : 'Add'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isEditorModalOpen && (
        <FoodCacheModal 
          isOpen={isEditorModalOpen}
          onClose={handleCloseEditorModal}
          fdcId={selectedFdcId}
        />
      )}
    </>
  );
}