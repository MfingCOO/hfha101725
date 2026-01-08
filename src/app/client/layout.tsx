'use client';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useEffect } from 'react';
import { BottomNavBar } from '@/components/layout/bottom-nav-bar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { GoogleAd } from '@/components/ads/google-ad';
import { ChallengesDialog } from '@/components/challenges/challenges-dialog';
import { ChatsDialog } from '@/components/chats/chats-dialog';
import { DashboardProvider, useDashboardActions } from '@/contexts/DashboardActionsContext';
import { CalendarDialog } from '@/components/calendar/calendar-dialog';
import type { ClientProfile } from '@/types';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Error Boundary Component is untouched
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

// DialogManager is untouched
function DialogManager() {
    const { userProfile } = useAuth();
    const {
        isChallengesOpen,
        onCloseChallenges,
        isChatsOpen,
        onCloseChats,
        isCalendarOpen,
        onCloseCalendar,
        isSettingsOpen,
        onCloseSettings
    } = useDashboardActions();

    return (
        <>
            <ChallengesDialog 
                isOpen={isChallengesOpen}
                onClose={onCloseChallenges}
            />
            <ChatsDialog
                isOpen={isChatsOpen}
                onClose={onCloseChats}
            />
            {userProfile && (
                <CalendarDialog
                    isOpen={isCalendarOpen}
                    onClose={onCloseCalendar}
                    client={userProfile as ClientProfile}
                />
            )}
            <SettingsDialog
                open={isSettingsOpen}
                onOpenChange={onCloseSettings}
            />
        </>
    );
}


export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, isCoach, userProfile } = useAuth();
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
          <AppSidebar />
          <SidebarInset className="h-dvh flex flex-col md:ml-64">
            <AppHeader />
            <main className="flex-1 overflow-y-auto">
             <ErrorBoundary router={router} toast={toast}>
              <div className="p-4 sm:p-6 lg:p-8 pb-24">
                {children}
              </div>
              {userProfile?.tier === 'free' && (
                <div className="sticky bottom-16 w-full p-2 bg-background/80 backdrop-blur-sm">
                  <GoogleAd slotId={process.env.NEXT_PUBLIC_AD_SLOT_ID_2!} />
                </div>
              )}
             </ErrorBoundary>
            </main>
            <BottomNavBar />
          </SidebarInset>

          <DialogManager />
      </SidebarProvider>
    </DashboardProvider>
  )
}
