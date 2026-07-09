'use client';

import { UserNav } from '@/components/auth/user-nav';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Logo } from '../icons/logo';
import { useAuth } from '../auth/auth-provider';
import { SidebarTrigger } from '../ui/sidebar';
import { useEffect, useState } from 'react';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const { isCoach, loading } = useAuth();
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
      )
    }
    return <h1 className="text-xl font-semibold tracking-tight">{getTitle()}</h1>
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        {/* Only show sidebar trigger for clients on mobile */}
        {!isCoach && (
          <SidebarTrigger className={cn("md:hidden", isMobile === undefined && "invisible")} />
        )}
        
        {siteUrl ? (
          <Link href={siteUrl} target="_blank" rel="noopener noreferrer">
            <TitleContent />
          </Link>
        ) : (
          <TitleContent />
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Coach/Client Switch Button - Only visible to coaches after loading */}
        {!loading && isCoach && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (pathname.includes('/coach')) {
                router.push('/client/dashboard');
              } else {
                router.push('/coach/dashboard');
              }
            }}
          >
            {pathname.includes('/coach') ? "Client" : "Coach"}
          </Button>
        )}

        <div className="flex items-center">
            <UserNav />
        </div>
      </div>
    </header>
  );
}