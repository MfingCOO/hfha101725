'use client';

import { useEffect } from 'react';
import { useAdMob } from '@/hooks/useAdMob';
import { BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const AdBannerProvider = () => {
  const { requestAdConsent, initializeAndShowBanner } = useAdMob();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const manageAds = async () => {
        await requestAdConsent();
        
        const bannerOptions: BannerAdOptions = {
          adId: 'ca-app-pub-3940256099942544/6300978111', // Test ID
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 56, // Keep ad above bottom nav bar
          isTesting: true,
        };
        await initializeAndShowBanner(bannerOptions);
      };

      manageAds();
    }
  }, [requestAdConsent, initializeAndShowBanner]);

  return null; // This component does not render anything
};

export default AdBannerProvider;
