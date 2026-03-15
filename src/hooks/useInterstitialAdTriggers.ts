'use client';

import { useEffect, useCallback, useRef } from 'react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { PluginListenerHandle } from '@capacitor/core';
import { useAdMob } from '@/hooks/useAdMob';
import { useCalendarStore } from '@/store/ui-store';
import { useSearchStore } from '@/store/search-store';

export const useInterstitialAdTriggers = () => {
  const { showInterstitialAd, prepareInterstitialAd } = useAdMob();
  const adId = 'ca-app-pub-3940256099942544/1033173712'; // Test ID
  
  // Ref to store the listener handle to ensure it persists across renders
  // and is available for the cleanup function.
  const listenerHandleRef = useRef<PluginListenerHandle | null>(null);

  const loadNextAd = useCallback(() => {
    prepareInterstitialAd({ adId });
  }, [prepareInterstitialAd, adId]);

  // Setup listeners and load the first ad
  useEffect(() => {
    // Initial load
    loadNextAd();

    const setupListener = async () => {
      try {
        // We await the promise to get the actual handle containing the .remove() method
        const handle = await AdMob.addListener(
          InterstitialAdPluginEvents.Dismissed, 
          () => {
            console.log('Interstitial ad dismissed. Loading next ad.');
            loadNextAd();
          }
        );
        listenerHandleRef.current = handle;
      } catch (error) {
        console.error('Error setting up AdMob listener:', error);
      }
    };

    setupListener();

    return () => {
      // Safe cleanup: only call remove if the handle was successfully created
      if (listenerHandleRef.current && typeof listenerHandleRef.current.remove === 'function') {
        listenerHandleRef.current.remove();
      }
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
        // Trigger ad when the search is cleared/reset (modal closed)
        if (prevState.hasSearched && !state.hasSearched) {
          console.log('Search reset, attempting to show interstitial ad.');
          showInterstitialAd();
        }
      }
    );
    return unsubscribe;
  }, [showInterstitialAd]);
};