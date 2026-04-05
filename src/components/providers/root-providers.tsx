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
import { useNotificationStore } from '@/store/notification-store';
import { Purchases } from '@revenuecat/purchases-capacitor';

const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null,
});

function RevenueCatInitializer() {
  const { user } = useAuth();
  const { setIsRevenueCatReady } = useNotificationStore();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
        setIsRevenueCatReady(false);
        return;
    }

    const initializeRevenueCat = async () => {
      const revenueCatApiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || "goog_NklNVostxEsZmVEiHkgORKJMJgp";

      try {
        if (user?.uid) {
          // Configure with the logged-in user's UID
          await Purchases.configure({ 
            apiKey: revenueCatApiKey, 
            appUserID: user.uid 
          });
          
          console.log("RevenueCat configured for user:", user.uid);
          setIsRevenueCatReady(true);

          // Listen for subscription changes (e.g., a purchase finishing)
          await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
            console.log("Subscription status updated:", customerInfo);
          });
        } else {
          // User logged out - clean up RevenueCat session
          setIsRevenueCatReady(false);
          const isConfigured = await Purchases.isConfigured();
          if (isConfigured) {
            await Purchases.logOut();
            console.log("RevenueCat logged out.");
          }
        }
      } catch (error) {
        console.error("RevenueCat initialization error:", error);
        setIsRevenueCatReady(false);
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