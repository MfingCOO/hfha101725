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
    let mounted = true;

    const initializeRevenueCat = async () => {
      console.log('🚀 RevenueCat init started');
      console.log('📱 isNativePlatform:', Capacitor.isNativePlatform());

      if (!Capacitor.isNativePlatform()) {
        console.log('🌐 Running on web → skipping native RevenueCat');
        if (mounted) setIsRevenueCatReady(false);
        return;
      }

      try {
        // Give the Capacitor native bridge a tiny moment to be fully ready
        await new Promise(resolve => setTimeout(resolve, 150));

        const revenueCatApiKey = Capacitor.getPlatform() === 'ios'
          ? "appl_DDutqwXiGASUOINloansPtOoSPt"
          : "goog_NklNVostxEsZmVEiHkgORKJMJgp";

        // Dynamic import that also brings in LOG_LEVEL (fixes your TypeScript error)
        const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');

        // Force native debug logging
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

        await Purchases.configure({
          apiKey: revenueCatApiKey,
          appUserID: user?.uid || null
        });

        console.log("✅ RevenueCat NATIVE mode configured. User ID:", user?.uid || "Anonymous");
        if (mounted) setIsRevenueCatReady(true);

        if (user?.uid) {
          await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
            console.log("📨 Subscription status updated:", customerInfo);
          });
        }
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
  // IMPORTANT: We start as false to match what the server renders during SSR/hydration.
  // Only after the component mounts on the client do we check the real platform.
  // This prevents React hydration error #418 on iOS WKWebView while keeping
  // identical runtime behavior for Android (free + paid) users.
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    initializeFirebasePersistence().catch(err =>
      console.error('[Firebase] Init Error:', err)
    );

    // This runs only after first render / hydration is complete.
    setIsNative(Capacitor.isNativePlatform());
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
                    {isNative ? (
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