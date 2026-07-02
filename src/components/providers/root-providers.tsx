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

const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

function RevenueCatInitializer() {
  const { user } = useAuth();
  const { setIsRevenueCatReady } = useNotificationStore();

  useEffect(() => {
    // Only run on native platforms (iOS/Android)
    if (!Capacitor.isNativePlatform()) {
      setIsRevenueCatReady(true); // Mark as ready on web so the app doesn't hang
      return;
    }

    let mounted = true;

    const initializeRevenueCat = async () => {
      try {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');

        const revenueCatApiKey = Capacitor.getPlatform() === 'ios'
          ? "appl_DDutqwXiGASUOINloansPtOoSPt"
          : "goog_NklNVostxEsZmVEiHkgORKJMJgp";

        await Purchases.configure({ apiKey: revenueCatApiKey });

        if (mounted) setIsRevenueCatReady(true);
      } catch (error) {
        console.error("❌ RevenueCat initialization error:", error);
        if (mounted) setIsRevenueCatReady(false);
      }
    };

    initializeRevenueCat();

    return () => { mounted = false; };
  }, [user?.uid, setIsRevenueCatReady]);

  return null;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    initializeFirebasePersistence().catch(err =>
      console.error('[Firebase] Init Error:', err)
    );
    setIsNative(Capacitor.isNativePlatform());
  }, []);

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
                    {isNative ? (
                      <AdBannerProvider>
                        {children}
                        <NotificationsDialog />
                      </AdBannerProvider>
                    ) : (
                      <>
                        {children}
                        <NotificationsDialog />
                      </>
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