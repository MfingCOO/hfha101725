'use client';

import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuth } from '@/components/auth/auth-provider';
import * as React from 'react';
import BottomNavBar from '@/components/layout/bottom-nav-bar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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
      <NotificationActionHandler />
      
      {/* Only render ChallengesDialog when profile exists */}
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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Please log in to continue.</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-dvh flex flex-col md:ml-64">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 pb-24">{children}</div>
        </main>
        <BottomNavBar />
      </SidebarInset>

      <DialogManager />
      <Toaster />
    </SidebarProvider>
  );
}