'use client';

import { AppHeader } from '@/components/layout/app-header';
import { useAuth } from '@/components/auth/auth-provider';
import { Suspense, type ReactNode } from 'react';
import BottomNavBar from '@/components/layout/bottom-nav-bar';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';
import { NotificationActionHandler } from '@/components/providers/NotificationActionHandler';
import { ChallengesDialog } from '@/components/challenges/challenges-dialog';
import { ChatsDialog } from '@/components/chats/chats-dialog';
import { CalendarDialog } from '@/components/calendar/calendar-dialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';

function DialogManager() {
  const { profile } = useAuth();
  const {
    isChallengesOpen,
    onCloseChallenges,
    isCalendarOpen,
    onCloseCalendar,
    isSettingsOpen,
    onCloseSettings
  } = useDashboardActions();

  return (
    <>
      <Suspense fallback={null}>
        <NotificationActionHandler />
      </Suspense>

      {profile && (
        <ChallengesDialog 
          isOpen={isChallengesOpen} 
          onClose={onCloseChallenges} 
          challenges={[]} 
          userProfile={profile} 
          isLoading={false} 
        />
      )}

      <ChatsDialog />

      {profile && isCalendarOpen && (
        <CalendarDialog 
          isOpen={isCalendarOpen} 
          onClose={onCloseCalendar} 
          client={profile} 
        />
      )}

      {isSettingsOpen && <SettingsDialog open={isSettingsOpen} onOpenChange={onCloseSettings} />}
      <NotificationsDialog />
    </>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p>Please log in to continue.</p>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col">
      <AppHeader />
      
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 sm:p-6 lg:p-8 pb-20">
          {children}
        </div>
      </main>

      <BottomNavBar />

      <DialogManager />
      <Toaster />
    </div>
  );
}