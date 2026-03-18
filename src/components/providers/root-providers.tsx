
'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from "@/components/auth/auth-provider"; // Import useAuth
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster"; // shadcn toaster
import { Toaster as SonnerToaster } from 'sonner'; // sonner for push notifications
import QueryProvider from "@/components/providers/QueryProvider";
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import { initializeFirebasePersistence } from '@/lib/firebase';
import { DashboardProvider } from '@/contexts/DashboardActionsContext';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';
import { ChatProvider } from '@/components/chats/chat-provider';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor'; // Import RevenueCat Purchases

// Dynamically import AdBannerProvider only on the client-side to prevent build errors on web.
const AdBannerProvider = dynamic(() => import('@/components/providers/AdBannerProvider'), {
  ssr: false,
  loading: () => null, // Or a loading spinner
});

export function RootProviders({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); // Use useAuth to get the current user

  useEffect(() => {
    // Initializing modern Firebase persistence logic
    initializeFirebasePersistence().catch(err => 
      console.error('[Firebase] Init Error:', err)
    );
  }, []);

  useEffect(() => {
    // Initialize RevenueCat when user is available (for both native and web/PWA)
    if (user?.uid) { // MODIFIED: Removed Capacitor.isNativePlatform() check
      // Use your specific RevenueCat API Key (unified for all platforms if possible)
      // YOU MUST RENAME NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY to NEXT_PUBLIC_REVENUECAT_API_KEY in your .env.local and apphosting.yaml
      const revenueCatApiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY; // MODIFIED: Renamed env var

      if (!revenueCatApiKey) {
        console.error("RevenueCat API Key (NEXT_PUBLIC_REVENUECAT_API_KEY) is not set. Please ensure it's configured in your environment variables.");
        return;
      }

      Purchases.configure({ apiKey: revenueCatApiKey, appUserID: user.uid })
        .then(() => {
          console.log("RevenueCat configured and identified.");
          // You might want to get customer info here to update local state immediately
          // Purchases.getCustomerInfo().then(customerInfo => console.log('Customer Info:', customerInfo));
        })
        .catch(error => {
          console.error("RevenueCat initialization or login failed:", error);
        });

      // Add a listener for whenever customer info updates (e.g., after a purchase, renewal)
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        console.log("RevenueCat Customer Info Updated:", customerInfo);
        // This is a good place to trigger a local state update for the user's tier
        // based on `customerInfo.entitlements.active`.
        // For now, we'll rely on the backend webhook to update Firestore.
      });

    } else if (Capacitor.isNativePlatform() && !user?.uid) { // Keep this for native logout/reset for consistency if a user logs out
      // If on native platform but no user, ensure RevenueCat is logged out or reset
      // This is important if a user logs out in your app.
      Purchases.logOut().catch(() => {}); // Attempt to log out if a user was previously logged in
    } else if (!user?.uid && !Capacitor.isNativePlatform()) { // ADDED: For web/PWA when no user is logged in, ensure RevenueCat is logged out/reset
      // For web/PWA when no user is logged in, RevenueCat should also be logged out or reset if configured.
      // This helps maintain a clean state, especially during anonymous usage or after web logout.
      Purchases.logOut().catch(() => {});
    }

  }, [user]); // Re-run when user object changes

  return (
    <QueryProvider>
      <AuthProvider>
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
