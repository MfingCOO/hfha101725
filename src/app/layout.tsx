import "./globals.css";
import { inter } from './fonts';
import { RootProviders } from "@/components/providers/root-providers";
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: "Hunger Free and Happy",
  description: "A wellness application.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // Critical for iOS safe areas in Capacitor
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      {/* 
        Removed h-dvh from body to prevent layout conflicts with padding.
        The wrapper div now handles the full height and safe area padding.
      */}
      <body className={`${inter.className} overflow-hidden bg-background text-foreground`}>
        <RootProviders>
          <div className="flex flex-col h-dvh w-full pt-[--safe-area-top] pb-[--safe-area-bottom]">
            {children}
          </div>
        </RootProviders>
      </body>
    </html>
  );
}
