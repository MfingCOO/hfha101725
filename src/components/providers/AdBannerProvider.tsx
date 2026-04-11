'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useAdMob } from '@/hooks/useAdMob';
import { AdMob, BannerAdOptions, BannerAdPluginEvents, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
// Create a context to hold the ad banner's height
const AdBannerContext = createContext({ adBannerHeight: 0 });
// Custom hook to access the ad banner's height
export const useAdBanner = () => useContext(AdBannerContext);
const AdBannerProvider = ({ children }: { children: React.ReactNode }) => {
  const { requestAdConsent, initializeAndShowBanner } = useAdMob();
  const [adBannerHeight, setAdBannerHeight] = useState(0);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const manageAds = async () => {
        await requestAdConsent();
        
        const bannerOptions: BannerAdOptions = {
          adId: 'ca-app-pub-3940256099942544/6300978111', // Test ID
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: true,
        };
        await initializeAndShowBanner(bannerOptions);
      };
      manageAds();
      // Add a listener for banner size changes
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
        setAdBannerHeight(info.height);
      });
    }
  }, [requestAdConsent, initializeAndShowBanner]);
  return (
    <AdBannerContext.Provider value={{ adBannerHeight }}>
      {children}
    </AdBannerContext.Provider>
  );
};
export default AdBannerProvider;