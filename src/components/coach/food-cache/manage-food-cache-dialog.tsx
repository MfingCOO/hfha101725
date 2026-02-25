'use client';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { hybridFoodSearch, bulkSaveFoodsToCache, getDetailsForCsvExport, getUnreviewedUserFoods } from '@/app/coach/food-cache/actions';
import { FoodCacheModal } from '@/components/coach/food-cache/food-cache-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from '@/components/ui/label';
import { HybridFoodSearchResult, EnrichedFood } from '@/types';
import { useAuth } from '@/components/auth/auth-provider';

interface ManageFoodCacheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CSV_HEADERS = [
    'fdcId', 'description', 'brandName', 'calories', 'protein', 'fat', 
    'carbs', 'sugar', 'fiber', 'servingSizes', 'upfPercentage', 
    'novaGroup', 'isGlutenFree', 'ingredients'
];

export function ManageFoodCacheDialog({ open, onOpenChange }: ManageFoodCacheDialogProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HybridFoodSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<'all' | 'cached' | 'usda'>('all');

  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedFdcId, setSelectedFdcId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewItems, setReviewItems] = useState<EnrichedFood[]>([]);
  const { user } = useAuth();

  const performSearch = useCallback(async () => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const results = await hybridFoodSearch(query, searchScope);
      setSearchResults(results);
    } catch (e) {
      setError('Failed to search for food items.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [query, searchScope]);

  useEffect(() => {
    if (isReviewMode) return;
    const delayDebounceFn = setTimeout(() => {
      if(open) performSearch();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [query, open, performSearch, isReviewMode]);

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
    if (isReviewMode) {
        enterReviewMode(); // Refresh review queue
    } else {
        performSearch(); // Refresh search results
    }
  };

  const handleBulkAddClick = () => {
    fileInputRef.current?.click();
  };

  const enterReviewMode = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const items = await getUnreviewedUserFoods();
        setReviewItems(items);
        setIsReviewMode(true);
    } catch (e) {
        setError('Failed to load review queue.');
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }

  const exitReviewMode = () => {
      setIsReviewMode(false);
      setError(null);
      setReviewItems([]);
      performSearch();
  }

  const handleDownloadCsv = async () => {
    if (searchResults.length === 0) return;
    setIsDownloading(true);
    setError(null);

    try {
        const allFoodsForCsv = await getDetailsForCsvExport(searchResults);

        const escapeCsvField = (field: any): string => {
            const stringField = String(field ?? '');
            return `"${stringField.replace(/"/g, '""')}"`;
        };
        
        const csvRows = allFoodsForCsv.map(food => {
            if (!food) return null;
            const getNutrient = (name: string) => food.nutrients.find(n => n.name.toLowerCase().includes(name))?.amount || '';
            
            const rowData = {
                fdcId: food.fdcId,
                description: food.description || '',
                brandName: (food as any).brandOwner || '',
                calories: getNutrient('energy') || getNutrient('calories'),
                protein: getNutrient('protein'),
                fat: getNutrient('fat'),
                carbs: getNutrient('carbohydrate'),
                sugar: getNutrient('sugars'),
                fiber: getNutrient('fiber'),
                servingSizes: (food as any).portionSizes?.map((p: any) => `${p.description}:${p.gramWeight}`).join('|') || '',
                upfPercentage: (food as any).upfPercentage?.value ?? '',
                novaGroup: (food as any).upfAnalysis?.rating || '',
                isGlutenFree: (food as any).glutenAnalysis?.isGlutenFree ?? '',
                ingredients: food.ingredients || ''
            };

            return CSV_HEADERS.map(header => escapeCsvField(rowData[header as keyof typeof rowData])).join(',');
        }).filter(Boolean);

        if (csvRows.length === 0) {
            setError("No detailed data could be fetched for the selected items.");
            return;
        }

        const csvString = [CSV_HEADERS.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `food_cache_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Failed to download CSV", error);
        setError("Failed to prepare data for download. Check console for details.");
    } finally {
        setIsDownloading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadStatus(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
          const result = await bulkSaveFoodsToCache(formData);
          if (result.success && result.details) {
              setUploadStatus({ 
                  message: `Success! Processed ${result.details.total} rows. Created: ${result.details.created}, Updated: ${result.details.updated}.`,
                  type: 'success' 
              });
              performSearch(); 
          } else {
              setUploadStatus({ message: result.error || 'An unknown error occurred during upload.', type: 'error' });
          }
      } catch (e: any) {
          setUploadStatus({ message: e.message || 'An unexpected client-side error occurred.', type: 'error' });
      } finally {
          setIsUploading(false);
          if (event.target) {
              event.target.value = ''; 
          }
      }
  };

  const MainContent = () => {
    if (isReviewMode) {
        return (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto p-1">
                <Button variant="link" onClick={exitReviewMode} className="mb-2">← Back to Search</Button>
                {reviewItems.length === 0 && !isLoading && <p className="text-center text-muted-foreground">No user-submitted foods to review.</p>}
                {reviewItems.map((food) => (
                    <div key={food.fdcId} className="p-3 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <p className="font-semibold">{food.description}</p>
                            <p className="text-sm text-muted-foreground">{food.brandOwner || 'No brand'} - Submitted by user {food.createdBy?.substring(0,5)}...</p>
                        </div>
                        <Button variant='secondary' onClick={() => handleOpenEditorModal(food.fdcId)} className="self-end sm:self-center">Review & Edit</Button>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto p-1">
            {searchResults.map((food) => (
                <div key={food.fdcId} className="p-3 border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className='max-w-prose'>
                        <p className="font-semibold">{food.description}</p>
                        <p className="text-sm text-muted-foreground">{food.brandOwner}</p>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0 self-end sm:self-center">
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
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-11/12 sm:w-full">
          <DialogHeader>
            <DialogTitle>{isReviewMode ? 'Review Custom Foods' : 'Manage Food Cache'}</DialogTitle>
          </DialogHeader>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".csv"
          />
          {!isReviewMode && (
            <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2 border-b mb-4">
                    <Label className="font-semibold">Search Scope:</Label>
                    <RadioGroup
                        value={searchScope}
                        onValueChange={(value: 'all' | 'cached' | 'usda') => setSearchScope(value)}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="scope-all" />
                            <Label htmlFor="scope-all">All Items</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cached" id="scope-cached" />
                            <Label htmlFor="scope-cached">In Cache</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="usda" id="scope-usda" />
                            <Label htmlFor="scope-usda">USDA Only</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div>
                    <Input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search in ${searchScope.charAt(0).toUpperCase() + searchScope.slice(1)}...`}
                    />
                </div>
            </>
          )}

          {uploadStatus && (
            <p className={`text-sm text-center py-2 px-4 rounded-md ${uploadStatus.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
                {uploadStatus.message}
            </p>
          )}

          {isLoading && <p className='text-center py-4'>Searching...</p>}
          {error && <p className="text-destructive text-center py-4">{error}</p>}

          <MainContent />

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between pt-4 gap-2">
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <Button variant="secondary" onClick={handleOpenCreatorModal}>
                Create New Food
              </Button>
              <Button variant="secondary" onClick={handleBulkAddClick} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Bulk Add From CSV'}
              </Button>
              <Button 
                variant="secondary"
                onClick={handleDownloadCsv}
                disabled={isDownloading || searchResults.length === 0}
              >
                {isDownloading ? 'Downloading...' : 'Download as CSV'}
              </Button>
              <Button 
                variant="secondary"
                onClick={enterReviewMode}
              >
                Review Custom Foods
              </Button>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isEditorModalOpen && (
        <FoodCacheModal 
          isOpen={isEditorModalOpen}
          onClose={handleCloseEditorModal}
          fdcId={selectedFdcId}
          mode={modalMode}
          isCoach={true}
          user={user}
        />
      )}
    </>
  );
}
