'use client';

import { Suspense, useEffect } from 'react';
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "@/components/providers/QueryProvider";
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import AdBannerProvider from "@/components/providers/AdBannerProvider";
import { initializeFirebasePersistence } from '@/lib/firebase';
import { DashboardProvider } from '@/contexts/DashboardActionsContext';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';
import { PushNotificationHandler } from '@/components/notifications/PushNotificationHandler';
import { ChatProvider } from '@/components/chats/chat-provider';
import { NotificationActionHandler } from '@/components/providers/NotificationActionHandler';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';

export function RootProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // This runs safely on the client side only
    console.log('[Firebase] Initializing services...');
    initializeFirebasePersistence().catch(err => {
      console.error('[Firebase] Init Error:', err);
    });
  }, []);

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
                    <PushNotificationHandler />
                    <NotificationActionHandler />
                  </PushNotificationProvider>
                </ChatProvider>
              </Suspense>
            </DashboardProvider>
            <Toaster />
          </DataEntryModalProvider>
        </AppCheckProvider>
        <AdBannerProvider />
      </AuthProvider>
    </QueryProvider>
  );
}
