'use client';

import { useEffect, useCallback } from 'react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { useAdMob } from '@/hooks/useAdMob';
import { useCalendarStore } from '@/store/ui-store';
import { useSearchStore } from '@/store/search-store';

export const useInterstitialAdTriggers = () => {
  const { showInterstitialAd, prepareInterstitialAd } = useAdMob();
  const adId = 'ca-app-pub-3940256099942544/1033173712'; // Test ID

  const loadNextAd = useCallback(() => {
    prepareInterstitialAd({ adId });
  }, [prepareInterstitialAd]);

  // Setup listeners and load the first ad
  useEffect(() => {
    // Load the first ad
    loadNextAd();

    // When an ad is closed, load the next one
    const adDismissedListener = AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      console.log('Interstitial ad dismissed. Loading next ad.');
      loadNextAd();
    });

    return () => {
      adDismissedListener.remove();
    };
  }, [loadNextAd]);


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
