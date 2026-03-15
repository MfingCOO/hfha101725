'use client';

import { Suspense, useEffect } from 'react';
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster"; // shadcn toaster
import { Toaster as SonnerToaster } from 'sonner'; // sonner for push notifications
import QueryProvider from "@/components/providers/QueryProvider";
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import AdBannerProvider from "@/components/providers/AdBannerProvider";
import { initializeFirebasePersistence } from '@/lib/firebase';
import { DashboardProvider } from '@/contexts/DashboardActionsContext';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';
import { ChatProvider } from '@/components/chats/chat-provider';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';

export function RootProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initializing modern Firebase persistence logic
    initializeFirebasePersistence().catch(err => 
      console.error('[Firebase] Init Error:', err)
    );
  }, []);

  return (
    <QueryProvider>
      <AuthProvider>
        <AppCheckProvider>
          <DataEntryModalProvider>
            <DashboardProvider>
              <Suspense fallback={null}>
                <ChatProvider>
                  {/* PushNotificationProvider is now the single source of truth 
                    for Firebase Cloud Messaging, token management, and navigation.
                  */}
                  <PushNotificationProvider>
                    {children}
                    <NotificationsDialog />
                  </PushNotificationProvider>
                </ChatProvider>
              </Suspense>
            </DashboardProvider>
            
            {/* Standard UI Feedback */}
            <Toaster />
            <SonnerToaster position="top-center" expand={true} richColors /> 
          </DataEntryModalProvider>
        </AppCheckProvider>

        {/* Guard: AdBanner can throw syntax errors in Webpack if it tries to 
          access Capacitor native APIs while running in a standard browser.
        */}
        {typeof window !== 'undefined' && <AdBannerProvider />}
      </AuthProvider>
    </QueryProvider>
  );
}