'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FoodItemRow } from './food-item-row';
import { Loader2, Search } from 'lucide-react';

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
  // SURGICAL CHANGE: The results state is now a single array, not an object of three arrays.
  const [results, setResults] = useState<SimpleFoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async () => {
    if (query.length < 3) {
      setResults([]);
      setHasSearched(true);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.log(`[SearchView] Search API returned status ${response.status}. This is now handled gracefully.`);
      }

      // SURGICAL CHANGE: Handle the new API response shape { results: [...] }.
      const searchData = await response.json().catch(() => null);
      setResults(searchData?.results || []);

    } catch (error) {
      console.error("[SearchView] A critical error occurred during the fetch operation:", error);
      setResults([]); // Clear results on critical failure
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

  // SURGICAL CHANGE: The `allResults` constant is no longer needed as `results` is now a single, sorted array.

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
        {/* SURGICAL CHANGE: Check `results.length` directly. */}
        {!isSearching && hasSearched && results.length === 0 && (
          <p className="text-center text-muted-foreground py-4">No results found.</p>
        )}
        {/* SURGICAL CHANGE: Map over `results` directly to preserve the backend sorting. */}
        {!isSearching && results.map((food) => (
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
