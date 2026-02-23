
'use client';

import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import { inter } from './fonts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, Suspense } from 'react';
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';
import { useAdMob } from '@/hooks/useAdMob';
import { BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient());
  const { requestAdConsent, initializeAndShowBanner } = useAdMob();

  // GDPR COMPLIANCE: Implement the correct ad consent flow on app startup.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const manageAds = async () => {
        // First, get the user's consent using the UMP SDK.
        await requestAdConsent();
        
        // THEN, initialize AdMob and show the banner ad.
        // This ensures AdMob is initialized with the correct consent status.
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
    }
  }, [requestAdConsent, initializeAndShowBanner]);

  // **THE FIX:** Manually register the service worker for push notifications.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <head>
        <title>Hunger Free and Happy</title>
        <meta name="description" content="A wellness application." />
      </head>
      <body className={`${inter.className} h-full`}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppCheckProvider>
                <DataEntryModalProvider>
                  <Suspense>
                    <PushNotificationProvider>
                      {children}
                    </PushNotificationProvider>
                  </Suspense>
                </DataEntryModalProvider>
            </AppCheckProvider>
          </AuthProvider>
        </QueryClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
