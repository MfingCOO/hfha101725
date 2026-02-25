import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} h-full bg-background text-foreground`}>
        <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-2xl space-y-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
