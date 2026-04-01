'use client';

import { Suspense, useEffect } from 'react';
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
import { Purchases } from '@revenuecat/purchases-capacitor';

// Dynamically import AdBannerProvider
const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

/**
 * This handles the RevenueCat setup.
 * It's nested inside AuthProvider so it can see who the user is.
 */
function RevenueCatInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    // FIX: This stops the "Web not supported" error. 
    // It only runs if the app is actually running on Android or iOS.
    if (!Capacitor.isNativePlatform()) return;

    if (user?.uid) {
      const revenueCatApiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;

      if (!revenueCatApiKey) {
        console.error("RevenueCat API Key is missing from your environment variables.");
        return;
      }

      Purchases.configure({ apiKey: revenueCatApiKey, appUserID: user.uid })
        .then(() => {
          console.log("RevenueCat ready on native device.");
        })
        .catch(error => {
          console.error("RevenueCat failed to start:", error);
        });

      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        console.log("Subscription status updated:", customerInfo);
      });

    } else {
      Purchases.logOut().catch(() => {});
    }
  }, [user]);

  return null;
}

export function RootProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeFirebasePersistence().catch(err => 
      console.error('[Firebase] Init Error:', err)
    );
  }, []);

  return (
    <QueryProvider>
      <AuthProvider>
        {/* This is the part we fixed so the build doesn't crash */}
        <RevenueCatInitializer />
        
        <AppCheckProvider>
          <DataEntryModalProvider>
            <DashboardProvider>
              <Suspense fallback={null}>
                <ChatProvider> 
                  <PushNotificationProvider> 
                    {children}
                    <NotificationsDialog /> 
                  </PushNotificationProvider>
                </ChatProvider>
              </Suspense>
            </DashboardProvider>
            
            <Toaster /> 
            <SonnerToaster position="top-center" expand={true} richColors /> 
          </DataEntryModalProvider>
        </AppCheckProvider>

        {Capacitor.isNativePlatform() && <AdBannerProvider />} 
      </AuthProvider>
    </QueryProvider>
  );
}