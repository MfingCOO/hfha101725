import "./globals.css";
import { inter } from './fonts';
import { RootProviders } from "@/components/providers/root-providers";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Hunger Free and Happy",
  description: "A wellness application.",
  icons: {
    icon: "/favicon.ico",           // ← This tells Next.js to use the favicon
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <body className={`${inter.className} h-full`}>
        <RootProviders>
          {children}
        </RootProviders>
      </body>
    </html>
  );
}