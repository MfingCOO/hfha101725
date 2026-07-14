'use client';

import { UserNav } from '@/components/auth/user-nav';
import { usePathname } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logo } from '../icons/logo';
import { useAuth } from '../auth/auth-provider';
import { useEffect, useState } from 'react';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import Link from 'next/link';

export function AppHeader() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { loading } = useAuth();
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  useEffect(() => {
    getSiteSettingsAction().then(result => {
      if (result.success && result.data?.url) {
        setSiteUrl(result.data.url);
      }
    });
  }, []);

  const getTitle = () => {
    if (pathname === '/' || pathname === '/client/dashboard' || pathname === '/coach/dashboard') {
      return 'Dashboard';
    }
    const name = pathname.split('/').pop() ?? 'Dashboard';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const TitleContent = () => {
    if (isMobile) {
      return (
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-primary" />
          <span className="font-semibold text-lg">Hunger-Free and Happy</span>
        </div>
      );
    }
    return <h1 className="text-xl font-semibold tracking-tight">{getTitle()}</h1>;
  };

  return (
    <header
      className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur-sm"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        minHeight: 'calc(4rem + env(safe-area-inset-top))'
      }}
    >
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {siteUrl ? (
            <Link href={siteUrl} target="_blank" rel="noopener noreferrer">
              <TitleContent />
            </Link>
          ) : (
            <TitleContent />
          )}
        </div>

        <div className="flex items-center">
          <UserNav />
        </div>
      </div>
    </header>
  );
}