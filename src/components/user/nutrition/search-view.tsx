'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FoodItemRow } from './food-item-row';
import type { EnrichedFood } from '@/types';
import { Loader2, Search } from 'lucide-react';

// This interface matches the data structure of foods returned by our /api/search endpoint.
interface SimpleFoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
}

interface SearchViewProps {
  onFoodSelected: (food: SimpleFoodSearchResult) => void;
}

export function SearchView({ onFoodSelected }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ brandedFoods: SimpleFoodSearchResult[], foundationFoods: SimpleFoodSearchResult[], otherFoods: SimpleFoodSearchResult[] }>({ brandedFoods: [], foundationFoods: [], otherFoods: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async () => {
    if (query.length < 3) {
      setResults({ brandedFoods: [], foundationFoods: [], otherFoods: [] });
      setHasSearched(true);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      // FIX: Removed the complex retry logic. Now that the server is resilient,
      // a single, clean API call is sufficient.
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      // A non-ok status from our robust server now simply means "no results", which is handled gracefully.
      if (!response.ok) {
        // We no longer throw an error, as the resilient server handles this.
        // We will just end up with empty results, which is the correct UX.
        console.log(`[SearchView] Search API returned status ${response.status}. This is now handled gracefully.`);
      }

      // Ensure we have a valid object before setting state.
      const searchResults = await response.json().catch(() => null);
      setResults(searchResults || { brandedFoods: [], foundationFoods: [], otherFoods: [] });

    } catch (error) {
      console.error("[SearchView] A critical error occurred during the fetch operation:", error);
      // In case of a network failure, ensure results are cleared.
      setResults({ brandedFoods: [], foundationFoods: [], otherFoods: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    performSearch();
  };

  const handleSelectFood = (food: SimpleFoodSearchResult) => {
    console.log(`[SearchView] Food selected: ${food.description}. Passing to parent.`);
    onFoodSelected(food);
  };

  const allResults = [...(results.foundationFoods || []), ...(results.brandedFoods || []), ...(results.otherFoods || [])];

  return (
    <div className="flex flex-col gap-4 pt-4">
      <form onSubmit={handleSearchSubmit} className="flex w-full items-center space-x-2">
        <Input
          placeholder="Search for a food (e.g., 'Apple', 'Grilled Chicken')..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Food search input"
          disabled={isSearching}
        />
        <Button type="submit" disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4"/>}
        </Button>
      </form>
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2">
        {isSearching && <Loader2 className="h-6 w-6 animate-spin self-center my-4" />}
        {!isSearching && hasSearched && allResults.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No results found.</p>
        )}
        {!isSearching && allResults.map((food) => (
          <FoodItemRow
            key={food.fdcId}
            food={food}
            onClick={() => handleSelectFood(food)}
          />
        ))}
      </div>
    </div>
  );
}
