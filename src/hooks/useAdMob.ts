'use client';

import { useState, useCallback } from 'react';
import { AdMob, AdOptions, BannerAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/components/auth/auth-provider';
import { UserTier } from '@/types';

// Keep track of initialization state globally within the hook's scope.
let isAdMobInitialized = false;

/**
 * Hook for managing AdMob ads, including GDPR consent flow.
 */
export const useAdMob = () => {
  const { userProfile } = useAuth();

  const shouldShowAds = useCallback(() => {
    if (userProfile?.tier !== UserTier.Free) return false;
    if (userProfile?.preferences?.adsEnabled === false) return false;
    return true;
  }, [userProfile]);

  // Robust initialize function that can be called multiple times safely.
  const initializeAdMob = useCallback(async () => {
    if (isAdMobInitialized || !Capacitor.isNativePlatform()) return;
    try {
      await AdMob.initialize();
      isAdMobInitialized = true;
      console.log('AdMob initialized.');
    } catch (e) {
      console.error('Error initializing AdMob:', e);
    }
  }, []);

  const requestAdConsent = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds()) return;
    try {
      const consentInfo = await AdMob.requestConsentInfo();
      if (consentInfo.status === 'REQUIRED') {
        await AdMob.showConsentForm();
      }
    } catch (e) {
      console.error('Error in UMP consent flow:', e);
    }
  }, [shouldShowAds]);

  const initializeAndShowBanner = useCallback(async (options: BannerAdOptions) => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds()) return;
    try {
      await initializeAdMob(); // Ensure initialized
      await AdMob.showBanner(options);
    } catch (e) {
      console.error('Error showing banner:', e);
    }
  }, [shouldShowAds, initializeAdMob]);

  const prepareInterstitialAd = useCallback(async (options: AdOptions) => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds()) return;
    try {
      await initializeAdMob(); // Ensure initialized
      await AdMob.prepareInterstitial(options);
      console.log('Interstitial ad prepared.');
    } catch (e) {
      console.error('Error preparing interstitial ad:', e);
    }
  }, [shouldShowAds, initializeAdMob]);

  const showInterstitialAd = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds() || !isAdMobInitialized) return;

    // REMOVED: Frequency cap for testing.
    // const lastAdShown = localStorage.getItem('lastAdShown');
    // if (lastAdShown && Date.now() - parseInt(lastAdShown, 10) < AD_FREQUENCY_CAP) {
    //   console.log('Ad frequency cap not met. Skipping interstitial.');
    //   return;
    // }

    try {
      console.log('Attempting to show interstitial ad.');
      await AdMob.showInterstitial();
      // localStorage.setItem('lastAdShown', Date.now().toString());
    } catch (e) {
      console.error('Error showing interstitial ad:', e);
    }
  }, [shouldShowAds]);

  return {
    requestAdConsent,
    initializeAndShowBanner,
    prepareInterstitialAd,
    showInterstitialAd,
  };
};
