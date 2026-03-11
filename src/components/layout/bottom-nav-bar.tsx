'use client';
import { Home, Calendar, MessageSquare, Trophy, Bell } from "lucide-react";
import Link from "next/link";
import { useDashboardActions, useDashboardState } from "@/contexts/DashboardActionsContext";
import { useChatModalStore } from "@/store/ui-store";
import { useNotificationStore } from "@/store/notification-store";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    notificationCount?: number;
    hasNotification?: boolean; 
    onClick?: () => void;
}

export default function BottomNavBar() {
    console.log('Rendering BottomNavBar...'); // DEBUG LINE
    const { unreadChatCount } = useDashboardState();
    const {
        onOpenCalendar,
        onOpenChallenges,
        setIsNotificationsOpen
    } = useDashboardActions();
    const hasUnreadNotifications = useNotificationStore((state) => state.hasUnreadNotifications);
    const { openModal: openChatModal } = useChatModalStore();

    const navItems: NavItem[] = [
        { href: "/client/dashboard", label: "Home", icon: Home },
        {
            href: "#",
            label: "Calendar",
            icon: Calendar,
            onClick: onOpenCalendar
        },
        {
            href: "#",
            label: "Chats",
            icon: MessageSquare,
            notificationCount: unreadChatCount,
            onClick: () => openChatModal()
        },
        {
            href: "#",
            label: "Challenges",
            icon: Trophy,
            onClick: onOpenChallenges
        },
        {
            href: "#",
            label: "Notifications",
            icon: Bell,
            hasNotification: hasUnreadNotifications,
            onClick: () => setIsNotificationsOpen(true)
        },
    ];

    if (typeof window === 'undefined') {
        return null;
    }

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 md:hidden">
            <nav className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const isLink = item.href !== "#";
                    const commonProps = {
                        className: "relative flex items-center justify-center text-gray-500 hover:text-primary transition-colors w-full h-full",
                        onClick: item.onClick,
                    };

                    const content = (
                        <>
                            <item.icon className="h-6 w-6" />
                            {item.hasNotification && (
                                <div className="absolute top-3 right-[calc(50%-1rem)] h-2 w-2 rounded-full bg-red-500"></div>
                            )}
                            {item.notificationCount != null && item.notificationCount > 0 && (
                                <div className="absolute top-2 right-[calc(50%-1.5rem)] h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                                    {item.notificationCount}
                                </div>
                            )}
                        </>
                    );

                    if (isLink) {
                        return (
                            <Link key={item.label} href={item.href} {...commonProps}>
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <button key={item.label} type="button" {...commonProps}>
                            {content}
                        </button>
                    );
                })}
            </nav>
        </footer>
    );
}
