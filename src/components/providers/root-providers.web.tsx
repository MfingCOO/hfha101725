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
    // This stops the "Web not supported" error on standard web builds
    // and ensures this logic only runs within a Capacitor environment.
    if (!Capacitor.isNativePlatform()) return;

    const initializeRevenueCat = async () => {
      if (user?.uid) {
        const revenueCatApiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;

        if (!revenueCatApiKey) {
          console.error("RevenueCat API Key is missing from your environment variables.");
          return;
        }

        try {
          // AWAIT the configuration to complete BEFORE proceeding.
          await Purchases.configure({ apiKey: revenueCatApiKey, appUserID: user.uid });
          console.log("RevenueCat configured successfully on native device.");

          // NOW that configuration is complete, we can safely add the listener.
          Purchases.addCustomerInfoUpdateListener((customerInfo) => {
            console.log("Subscription status updated:", customerInfo);
            // TODO: Here you can update your app's state based on the new customerInfo
          });

        } catch (error) {
          console.error("RevenueCat failed to configure:", error);
        }

      } else {
        // If there is no user, log out of RevenueCat to clear any cached data.
        try {
          await Purchases.logOut();
          console.log("RevenueCat logged out.");
        } catch (error) {
          // This can sometimes fail if not configured, so we catch and ignore.
        }
      }
    };

    initializeRevenueCat();
    
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
