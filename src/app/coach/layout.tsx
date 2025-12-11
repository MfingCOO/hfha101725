
'use client';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { DashboardProvider, useDashboardActions } from '@/contexts/DashboardActionsContext';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

const CoachLayoutContent = ({ children }: { children: React.ReactNode }) => {
    const { isSettingsOpen, onCloseSettings } = useDashboardActions();

    return (
        <>
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
  children: React.ReactNode
}) {
    const { isCoach, loading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && !isCoach) {
            router.replace('/');
        }
    }, [isCoach, loading, user, router]);
    
    if (loading || !user) {
        return null;
    }

    return (
        <DashboardProvider>
            <SidebarProvider>
                <CoachLayoutContent>{children}</CoachLayoutContent>
            </SidebarProvider>
        </DashboardProvider>
    );
}
