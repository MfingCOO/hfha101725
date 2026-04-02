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
import { useNotificationStore } from '@/store/notification-store';

const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

function RevenueCatInitializer() {
  const { user } = useAuth();
  const { setIsRevenueCatReady } = useNotificationStore();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initializeRevenueCat = async () => {
      if (user?.uid) {
        const revenueCatApiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;

        if (!revenueCatApiKey) {
          console.error("RevenueCat API Key is missing.");
          return;
        }

        try {
          await Purchases.configure({ apiKey: revenueCatApiKey, appUserID: user.uid });
          console.log("RevenueCat configured successfully.");
          
          // SET THE GLOBAL FLAG
          setIsRevenueCatReady(true);

          Purchases.addCustomerInfoUpdateListener((customerInfo) => {
            console.log("Subscription status updated:", customerInfo);
          });

        } catch (error) {
          console.error("RevenueCat failed to configure:", error);
          setIsRevenueCatReady(false);
        }

      } else {
        setIsRevenueCatReady(false);
        try {
          await Purchases.logOut();
          console.log("RevenueCat logged out.");
        } catch (error) {
          // Ignore errors on logout
        }
      }
    };

    initializeRevenueCat();
    
  }, [user, setIsRevenueCatReady]);

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
