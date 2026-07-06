'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider } from "@/components/auth/auth-provider";
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

const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

function RevenueCatInitializer() {
  const { setIsRevenueCatReady } = useNotificationStore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const init = async () => {
      try {
        console.log('🚀 RevenueCat initialized');
        setIsRevenueCatReady(true);
      } catch (error) {
        console.error("❌ RevenueCat initialization error:", error);
        setIsRevenueCatReady(false);
      }
    };

    init();
  }, [isClient, setIsRevenueCatReady]);

  return null;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
                    {Capacitor.isNativePlatform() ? (
                      <AdBannerProvider>
                        <MainContent />
                      </AdBannerProvider>
                    ) : (
                      <MainContent />
                    )}
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