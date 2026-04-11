'use client';

import { Suspense, useEffect } from 'react';
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

/**
 * For Web: RevenueCat is not supported. 
 * This component simply ensures the app state knows billing is inactive.
 */
function RevenueCatInitializer() {
  const { setIsRevenueCatReady } = useNotificationStore();

  useEffect(() => {
    // Explicitly set to false as this file is only loaded in Web environments
    setIsRevenueCatReady(false);
    console.log("RevenueCat (Web): Native billing is disabled.");
  }, [setIsRevenueCatReady]);

  return null;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Firebase persistence (IndexedDB for Web)
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
        {/* Handles the state for the notification store without calling native plugins */}
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
