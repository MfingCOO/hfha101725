'use client';

import { create } from 'zustand';

// Define the shape of the search result data
interface SimpleFoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
  isCached?: boolean;
}

// Define the state and actions for our store
interface SearchState {
  query: string;
  results: SimpleFoodSearchResult[];
  hasSearched: boolean;
  setQuery: (query: string) => void;
  setResults: (results: SimpleFoodSearchResult[]) => void;
  setHasSearched: (hasSearched: boolean) => void;
  reset: () => void; // Function to reset the store to its initial state
}

// Create the store
export const useSearchStore = create<SearchState>((set) => ({
  // Initial state
  query: '',
  results: [],
  hasSearched: false,

  // Actions to update the state
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setHasSearched: (hasSearched) => set({ hasSearched }),
  
  // Action to reset the store
  reset: () => set({ query: '', results: [], hasSearched: false }),
}));
