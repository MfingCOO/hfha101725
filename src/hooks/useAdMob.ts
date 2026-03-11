
import { useState, useEffect, useCallback } from 'react';
import { AdMob, AdOptions, BannerAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/components/auth/auth-provider';
import { UserTier } from '@/types';

const AD_FREQUENCY_CAP = 10 * 60 * 1000; // 10 minutes in milliseconds
/**
 * Hook for managing AdMob ads, including GDPR consent flow.
 */
export const useAdMob = () => {
  const { userProfile } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  const shouldShowAds = useCallback(() => {
    if (userProfile?.tier !== UserTier.Free) return false;
    if (userProfile?.preferences?.adsEnabled === false) return false;
    return true;
  }, [userProfile]);

  /**
   * Implements the Google User Messaging Platform (UMP) SDK flow for GDPR consent.
   */
  const requestAdConsent = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds()) {
      return;
    }
    try {
      const consentInfo = await AdMob.requestConsentInfo();
      // ** THE FIX: ** 'ConsentStatus' is not an export. Compare to the string 'REQUIRED'.
      if (consentInfo.status === 'REQUIRED') {
        await AdMob.showConsentForm();
      }
    } catch (e) {
      console.error('Error in UMP consent flow:', e);
    }
  }, [shouldShowAds]);

  /**
   * Initializes AdMob and shows a banner ad. Should be called AFTER the consent flow.
   */
  const initializeAndShowBanner = useCallback(async (options: BannerAdOptions) => {
    if (!Capacitor.isNativePlatform() || !shouldShowAds()) {
      return;
    }
    try {
      await AdMob.initialize({});
      setIsInitialized(true);
      await AdMob.showBanner(options);
    } catch (e) {
      console.error('Error initializing AdMob or showing banner:', e);
    }
  }, [shouldShowAds]);

  const prepareInterstitialAd = useCallback(async (options: AdOptions) => {
    if (!isInitialized || !Capacitor.isNativePlatform() || !shouldShowAds()) return;
    try {
      await AdMob.prepareInterstitial(options);
    } catch (e) {
      console.error('Error preparing interstitial ad:', e);
    }
  }, [isInitialized, shouldShowAds]);

  const showInterstitialAd = useCallback(async () => {
    if (!isInitialized || !Capacitor.isNativePlatform() || !shouldShowAds()) return;

    const lastAdShown = localStorage.getItem('lastAdShown');
    if (lastAdShown && Date.now() - parseInt(lastAdShown, 10) < AD_FREQUENCY_CAP) {
      console.log('Ad frequency cap not met. Skipping interstitial.');
      return;
    }

    try {
      await AdMob.showInterstitial();
      localStorage.setItem('lastAdShown', Date.now().toString());
    } catch (e) {
      console.error('Error showing interstitial ad:', e);
    }
  }, [isInitialized, shouldShowAds]);

  return {
    requestAdConsent,
    initializeAndShowBanner,
    prepareInterstitialAd,
    showInterstitialAd,
  };
};
