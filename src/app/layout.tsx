import "./globals.css";
import { inter } from './fonts';
import { RootProviders } from "@/components/providers/root-providers";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Hunger Free and Happy",
  description: "A wellness application.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.className} h-dvh overflow-hidden`}>
        <RootProviders>
          {children}
        </RootProviders>
      </body>
    </html>
  );
}