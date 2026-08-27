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

function RevenueCatInitializer() {
  const { setIsRevenueCatReady, isRevenueCatReady } = useNotificationStore();
  const { user } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !Capacitor.isNativePlatform()) return;

    const init = async () => {
      try {
        const platform = Capacitor.getPlatform();
        const apiKey = platform === 'ios' 
          ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY 
          : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;

        if (!apiKey) {
          throw new Error(`RevenueCat API key for ${platform} is not defined. Make sure it's in your .env.local and Vercel environment variables.`);
        }
        
        await Purchases.configure({ apiKey });

        console.log('🚀 RevenueCat initialized successfully');
        setIsRevenueCatReady(true);
      } catch (error) {
        console.error("❌ RevenueCat initialization error:", error);
        setIsRevenueCatReady(false);
      }
    };

    init();
  }, [isClient, setIsRevenueCatReady]);

  // Identity Sync: Ensure RevenueCat always knows who the Firebase user is
  useEffect(() => {
    if (isRevenueCatReady && user?.uid && Capacitor.isNativePlatform()) {
      console.log(`🔗 Syncing RevenueCat identity for: ${user.uid}`);
      Purchases.logIn({ appUserID: user.uid }).catch(err => 
        console.error("❌ RevenueCat identity sync error:", err)
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
