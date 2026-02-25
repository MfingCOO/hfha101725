'use client'; 

import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import Script from 'next/script';
import { inter } from './fonts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationPresenter } from '@/components/notifications/NotificationPresenter';
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <head>
        <title>Hunger Free and Happy</title>
        <meta name="description" content="A wellness application." />
      </head>
      <body className={`${inter.className} h-full`}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppCheckProvider>
              <PushNotificationProvider>
                <NotificationProvider>
                  <DataEntryModalProvider>
                    {children}
                    <NotificationPresenter />
                  </DataEntryModalProvider>
                </NotificationProvider>
              </PushNotificationProvider>
            </AppCheckProvider>
          </AuthProvider>
        </QueryClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
