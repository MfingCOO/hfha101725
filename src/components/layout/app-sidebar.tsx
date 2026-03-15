'use client';

import * as React from 'react';
import {
  LayoutDashboard,
  Settings,
  Calendar,
  MessageSquare,
  Trophy,
  Bell,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons/logo';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from '../auth/user-nav';
import { useAuth } from '../auth/auth-provider';
import { useDashboardActions, useDashboardState } from '@/contexts/DashboardActionsContext';
import { useChatModalStore } from '@/store/ui-store';
import { useNotificationStore } from '@/store/notification-store';

export function AppSidebar() {
  const pathname = usePathname();
  const { isCoach } = useAuth();
  const { onOpenChallenges, onOpenCalendar, onOpenSettings, setIsNotificationsOpen } = useDashboardActions();
  const { openModal: openChatModal } = useChatModalStore();
  const { unreadChatCount } = useDashboardState();
  const { hasUnreadNotifications } = useNotificationStore();

  // Standard mounting state
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const clientMenuItems = [
    { href: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard, isLink: true, id: 'dashboard', onClick: undefined },
    { href: '#', label: 'Calendar', icon: Calendar, isLink: false, id: 'calendar', onClick: onOpenCalendar },
    { href: '#', label: 'Chats', icon: MessageSquare, isLink: false, id: 'chats', onClick: () => openChatModal(undefined) },
    { href: '#', label: 'Challenges', icon: Trophy, isLink: false, id: 'challenges', onClick: onOpenChallenges },
  ];

  const coachMenuItems = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: LayoutDashboard, isLink: true, id: 'dashboard', onClick: undefined },
  ];

  const menuItems = isCoach ? coachMenuItems : clientMenuItems;

  return (
    <Sidebar suppressHydrationWarning>
      <SidebarHeader>
        <Logo className="text-primary size-8" />
        <h1 className="text-xl font-semibold tracking-tight">
          HungerFree
        </h1>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              {item.isLink ? (
                <Link href={item.href!}>
                  <SidebarMenuButton
                    isActive={!!pathname && pathname.startsWith(item.href!)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              ) : (
                <SidebarMenuButton
                  isActive={false}
                  tooltip={item.label}
                  onClick={item.onClick}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <item.icon />
                      <span className='ml-4'>{item.label}</span>
                    </div>
                    {mounted && item.id === 'chats' && unreadChatCount > 0 && (
                      <span className="ml-auto text-xs font-semibold text-white bg-red-500 rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadChatCount}
                      </span>
                    )}
                  </div>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={"Notifications"}
              onClick={() => setIsNotificationsOpen(true)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <Bell />
                  <span className='ml-4'>Notifications</span>
                </div>
                {mounted && hasUnreadNotifications && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-red-500"></span>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={"Settings"}
              onClick={onOpenSettings} 
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <div className="p-2 border-t mt-auto">
            {mounted && <UserNav />}
          </div>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}