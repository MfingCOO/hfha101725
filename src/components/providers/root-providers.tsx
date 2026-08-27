'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from 'sonner';
import QueryProvider from "@/components/providers/QueryProvider";
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import { initializeFirebasePersistence } from '@/lib/firebase';
import { DashboardProvider } from '@/contexts/DashboardActionsContext';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';
import { ChatProvider } from '@/components/chats/chat-provider';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';
import { Capacitor } from '@capacitor/core';
import { useNotificationStore } from '@/store/notification-store';
import { Purchases } from '@revenuecat/purchases-capacitor';

const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

// HARDCODED KEYS - This is the fix.
const REVENUECAT_IOS_KEY = "appl_WIImyDdSpgaTOCuVFZLidwLlcih";
const REVENUECAT_ANDROID_KEY = "goog_NklNVostxEsZmVEiHkgORKJMJgp";

function RevenueCatInitializer() {
  const { setIsRevenueCatReady, isRevenueCatReady } = useNotificationStore();
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || isRevenueCatReady) return;

    const init = async () => {
      try {
        const platform = Capacitor.getPlatform();
        const apiKey = platform === 'ios' 
          ? REVENUECAT_IOS_KEY
          : REVENUECAT_ANDROID_KEY;
        
        await Purchases.configure({ apiKey });
        console.log('🚀 RevenueCat configured successfully');
        setIsRevenueCatReady(true);
        
      } catch (error) {
        console.error("❌ RevenueCat initialization failed:", error);
      }
    };

    init();
  }, [isRevenueCatReady, setIsRevenueCatReady]);

  useEffect(() => {
    if (isRevenueCatReady && user?.uid && Capacitor.isNativePlatform()) {
      Purchases.logIn({ appUserID: user.uid }).catch(err => 
        console.error("❌ RC Identity Sync Error:", err)
      );
    }
  }, [isRevenueCatReady, user?.uid]);

  return null;
}


export function RootProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeFirebasePersistence().catch(err => 
      console.error('[Firebase] Init Error:', err)
    );
  }, []);

  const MainContent = () => (
    <>
      {children}
      <NotificationsDialog />
    </>
  );

  return (
    <QueryProvider>
      <AuthProvider>
        <RevenueCatInitializer />
        <AppCheckProvider>
          <DataEntryModalProvider>
            <DashboardProvider>
              <Suspense fallback={null}>
                <ChatProvider>
                  <PushNotificationProvider>
                    <MainContent />
                  </PushNotificationProvider>
                </ChatProvider>
              </Suspense>
            </DashboardProvider>
            <Toaster />
            <SonnerToaster position="top-center" expand={true} richColors />
          </DataEntryModalProvider>
        </AppCheckProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
