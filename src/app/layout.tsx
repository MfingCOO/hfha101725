'use client'; // This directive MUST be the very first line

    import "./globals.css";
    import { AuthProvider } from "@/components/auth/auth-provider";
    import { AppCheckProvider } from "@/components/auth/app-check-provider";
    import { Toaster } from "@/components/ui/toaster";
    import Script from 'next/script';

    // **CRITICAL FIX:** Import the 'inter' font object from your new fonts file
    // This path is relative to src/app/layout.tsx
    import { inter } from './fonts';

    // NEW IMPORTS FOR REACT QUERY
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { useState } from 'react';

    export default function RootLayout({
      children,
    }: Readonly<{
      children: React.ReactNode;
    }>) {
      // Create a QueryClient instance using useState to prevent re-creation on every render
      // This requires 'layout.tsx' to be a Client Component ('use client')
      const [queryClient] = useState(() => new QueryClient());

      return (
        <html lang="en" suppressHydrationWarning className="dark h-full">
          <head>
            <title>Hunger Free and Happy</title>
            <meta name="description" content="A wellness application." />
             {process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID && (
                <Script
                  async
                  src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID}`}
                  crossOrigin="anonymous"
                  strategy="afterInteractive"
                />
              )}
          </head>
          <body className={`${inter.className} h-full`}>
            {/* Wrap with QueryClientProvider to make react-query available */}
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <AppCheckProvider>
                  {children}
                </AppCheckProvider>
              </AuthProvider>
            </QueryClientProvider>
            <Toaster />
          </body>
        </html>
      );
    }