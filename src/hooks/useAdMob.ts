
import { useState, useEffect, useCallback } from 'react';
import { AdMob, AdOptions, BannerAdOptions } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/components/auth/auth-provider';
import { UserTier } from '@/types';

const AD_FREQUENCY_CAP = 10 * 60 * 1000; // 10 minutes in milliseconds

export const useAdMob = () => {
  const { userProfile } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  
  const isFreeTier = useCallback(() => {
    return userProfile?.tier === UserTier.Free;
  }, [userProfile]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AdMob.initialize({}).then(() => setIsInitialized(true));
    }
  }, []);

  const showBannerAd = useCallback(async (options: BannerAdOptions) => {
    if (!isInitialized || !Capacitor.isNativePlatform() || !isFreeTier()) {
      return;
    }
    try {
      await AdMob.showBanner(options);
    } catch (e) {
      console.error('Error showing banner ad:', e);
    }
  }, [isInitialized, isFreeTier]);

  const prepareInterstitialAd = useCallback(async (options: AdOptions) => {
    if (!isInitialized || !Capacitor.isNativePlatform() || !isFreeTier()) {
      return;
    }
    try {
      await AdMob.prepareInterstitial(options);
    } catch (e) {
      console.error('Error preparing interstitial ad:', e);
    }
  }, [isInitialized, isFreeTier]);

  const showInterstitialAd = useCallback(async () => {
    if (!isInitialized || !Capacitor.isNativePlatform() || !isFreeTier()) {
      return;
    }

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
  }, [isInitialized, isFreeTier]);

  return {
    showBannerAd,
    prepareInterstitialAd,
    showInterstitialAd,
  };
};
