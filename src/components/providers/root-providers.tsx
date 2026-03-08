'use client';

import { useEffect } from 'react';
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "@/components/providers/QueryProvider";
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import AdBannerProvider from "@/components/providers/AdBannerProvider";
import { initializeFirebasePersistence } from '@/lib/firebase';
import { DashboardProvider } from '@/contexts/DashboardActionsContext'; // FIX: Corrected the import path
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';

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
              {children}
              <NotificationsDialog />
            </DashboardProvider>
            <Toaster />
          </DataEntryModalProvider>
        </AppCheckProvider>
        <AdBannerProvider />
      </AuthProvider>
    </QueryProvider>
  );
}
