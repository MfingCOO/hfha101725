
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppCheckProvider } from "@/components/auth/app-check-provider";
import { Toaster } from "@/components/ui/toaster";
import { inter } from './fonts';
import QueryProvider from "@/components/providers/QueryProvider"; // Import the new QueryProvider
import { Suspense } from 'react';
import { DataEntryModalProvider } from '@/contexts/DataEntryModalContext';
import PushNotificationProvider from '@/components/providers/PushNotificationProvider';
import AdBannerProvider from "@/components/providers/AdBannerProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <head>
        <title>Hunger Free and Happy</title>
        <meta name="description" content="A wellness application." />
      </head>
      <body className={`${inter.className} h-full`}>
        <QueryProvider>
          <AuthProvider>
            <AppCheckProvider>
                <DataEntryModalProvider>
                  <Suspense>
                    <PushNotificationProvider>
                      {children}
                    </PushNotificationProvider>
                  </Suspense>
                </DataEntryModalProvider>
            </AppCheckProvider>
          </AuthProvider>
        </QueryProvider>
        <AdBannerProvider />
        <Toaster />
      </body>
    </html>
  );
}
