import "./globals.css";
import { inter } from './fonts';
import { RootProviders } from "@/components/providers/root-providers";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Hunger Free and Happy",
  description: "A wellness application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <body className={`${inter.className} h-full`}>
        {/* All client-side providers and Firebase logic move here */}
        <RootProviders>
          {children}
        </RootProviders>
      </body>
    </html>
  );
}