'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { NotificationActionHandler } from '@/components/providers/NotificationActionHandler';
import { useNotificationStore } from '@/store/notification-store';
import React from 'react';
import { Loader2 } from 'lucide-react';

const CoachLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { isSettingsOpen, onCloseSettings } = useDashboardActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setNotificationChatId } = useNotificationStore();

  useEffect(() => {
    if (searchParams) {
      const chatId = searchParams.get('chatId');
      if (chatId) {
        console.log(`[CoachLayout] Deep link: Found chatId=${chatId} in URL. Opening chat.`);
        setNotificationChatId(chatId);
        router.replace('/coach/dashboard', { scroll: false });
      }
    }
  }, [searchParams, setNotificationChatId, router]);

  return (
    <>
      <NotificationActionHandler />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={onCloseSettings}
      />
    </>
  );
};

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCoach, loading, user } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setShowContent(true);
  }, []);

  useEffect(() => {
    if (isMounted && !loading && user && !isCoach) {
      router.replace('/');
    }
  }, [isMounted, isCoach, loading, user, router]);

  if (!isMounted || loading || !user) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      {showContent && (
        <CoachLayoutContent>{children}</CoachLayoutContent>
      )}
    </SidebarProvider>
  );
}