'use client';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useEffect, useState, Suspense, useCallback } from 'react';
import BottomNavBar from '@/components/layout/bottom-nav-bar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ChallengesDialog } from '@/components/challenges/challenges-dialog';
import { ChatsDialog } from '@/components/chats/chats-dialog';
import { DashboardProvider, useDashboardActions } from '@/contexts/DashboardActionsContext';
import { CalendarDialog } from '@/components/calendar/calendar-dialog';
import type { ClientProfile, Challenge } from '@/types';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { NotificationActionHandler } from '@/components/providers/NotificationActionHandler';
import { useNotificationStore } from '@/store/notification-store';
import { getChallengesForClient } from '@/app/challenges/actions';
import { Toaster } from '@/components/ui/toaster';

// --- NO CHANGES TO ERRORBOUNDARY ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
  router: { push: (path: string) => void; };
  toast: ({...args}: any) => void;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Caught by local error boundary:", error, errorInfo);
    this.props.toast({
        variant: 'default',
        title: 'So Sorry!',
        description: 'It looks like we hit a small snag. Your last action might not have been saved, but you\'re safely back on the dashboard.',
        duration: 2000,
    });
    this.props.router.push('/client/dashboard');
    setTimeout(() => this.setState({ hasError: false }), 50);
  }
  render() {
    if (this.state.hasError) {
      return (
         <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-2">Redirecting to dashboard...</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// FIX: Updated DialogManager to fetch challenges
function DialogManager() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const {
        isChallengesOpen,
        onCloseChallenges,
        isCalendarOpen,
        onCloseCalendar,
        isSettingsOpen,
        onCloseSettings
    } = useDashboardActions();

    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isChallengesOpen && profile) {
            setIsLoading(true);
            getChallengesForClient().then(result => {
                if (result.success && result.data) {
                    // Smart sorting: challenges the user has joined appear first
                    const sortedData = [...result.data].sort((a, b) => {
                        const aJoined = a.participants.includes(profile.uid);
                        const bJoined = b.participants.includes(profile.uid);
                        if (aJoined && !bJoined) return -1;
                        if (!aJoined && bJoined) return 1;
                        return 0;
                    });
                    setChallenges(sortedData);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load challenges.' });
                    setChallenges([]);
                }
                setIsLoading(false);
            });
        }
    }, [isChallengesOpen, profile, toast]);

    return (
        <>
            <NotificationActionHandler />
            <ChallengesDialog
                key="challenges"
                isOpen={isChallengesOpen}
                onClose={onCloseChallenges}
                challenges={challenges}
                userProfile={profile as ClientProfile}
                isLoading={isLoading} // Pass loading state
            />
            <ChatsDialog key="chats" />
            {profile && (
                <CalendarDialog
                    key="calendar"
                    isOpen={isCalendarOpen}
                    onClose={onCloseCalendar}
                    client={profile as ClientProfile}
                />
            )}
            <SettingsDialog
                key="settings"
                open={isSettingsOpen}
                onOpenChange={onCloseSettings}
            />
        </>
    );
}

// FIX: New helper component to isolate useSearchParams
function SearchParamHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setNotificationChatId } = useNotificationStore();

  useEffect(() => {
    if (searchParams) {
        const chatId = searchParams.get('chatId');
        if (chatId) {
          console.log(`[ClientLayout] Deep link: Found chatId=${chatId} in URL. Opening chat.`);
          setNotificationChatId(chatId);
          router.replace('/client/dashboard', { scroll: false });
        }
    }
  }, [searchParams, setNotificationChatId, router]);

  return null; // This component doesn't render anything visual
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, isCoach } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && isCoach) {
      router.replace('/coach/dashboard');
    }
  }, [user, loading, isCoach, router]);

  if (loading || !user || isCoach) {
    return (
        <div className="w-full h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <DashboardProvider>
      <SidebarProvider>
          {/* FIX: Wrap SearchParamHandler in Suspense to satisfy Next.js build */}
          <Suspense fallback={null}>
            <SearchParamHandler />
          </Suspense>
          
          <AppSidebar />
          <SidebarInset className="h-dvh flex flex-col md:ml-64">
            <AppHeader />
            <main className="flex-1 overflow-y-auto">
             <ErrorBoundary router={router} toast={toast}>
              <div className="p-4 sm:p-6 lg:p-8 pb-24">
                {children}
              </div>
             </ErrorBoundary>
            </main>
            <BottomNavBar />
          </SidebarInset>
          <DialogManager />
          <Toaster />
      </SidebarProvider>
    </DashboardProvider>
  )
}
