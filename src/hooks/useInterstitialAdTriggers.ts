'use client';

import { useEffect } from 'react';
import { useAdMob } from '@/hooks/useAdMob';
import { useCalendarStore } from '@/store/ui-store';
import { useSearchStore } from '@/store/search-store';

export const useInterstitialAdTriggers = () => {
  const { showInterstitialAd, prepareInterstitialAd } = useAdMob();

  // Prepare the ad when the app loads
  useEffect(() => {
    prepareInterstitialAd({ adId: 'ca-app-pub-3940256099942544/1033173712' }); // Test ID
  }, [prepareInterstitialAd]);

  // Trigger for Calendar Modal closing
  useEffect(() => {
    const unsubscribe = useCalendarStore.subscribe(
      (state, prevState) => {
        if (prevState.isOpen && !state.isOpen) {
          console.log('Calendar closed, attempting to show interstitial ad.');
          showInterstitialAd();
        }
      }
    );
    return unsubscribe;
  }, [showInterstitialAd]);

  // Trigger for Search/Nutrition Modal closing
  useEffect(() => {
    const unsubscribe = useSearchStore.subscribe(
      (state, prevState) => {
        // Assuming closing the nutrition modal resets the search store
        if (prevState.hasSearched && !state.hasSearched) {
          console.log('Search reset, attempting to show interstitial ad.');
          showInterstitialAd();
        }
      }
    );
    return unsubscribe;
  }, [showInterstitialAd]);
};
