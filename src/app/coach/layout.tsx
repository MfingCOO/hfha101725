'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';
import { ChatsDialog } from '@/components/chats/chats-dialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';

function DialogManager() {
  const { profile } = useAuth();
  const {
    isSettingsOpen,
    onCloseSettings
  } = useDashboardActions();

  return (
    <>
      <ChatsDialog />
      {isSettingsOpen && (
        <SettingsDialog
          open={isSettingsOpen}
          onOpenChange={onCloseSettings}
        />
      )}
    </>
  );
}

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCoach, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/');
      } else if (!isCoach) {
        // Only non-coaches get redirected away from coach routes
        router.replace('/client/dashboard');
      }
    }
  }, [isCoach, loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render coach layout content for non-coaches
  if (!isCoach) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-dvh flex flex-col md:ml-64">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 pb-24">
            {children}
          </div>
        </main>
      </SidebarInset>

      <DialogManager />
      <Toaster />
    </SidebarProvider>
  );
}