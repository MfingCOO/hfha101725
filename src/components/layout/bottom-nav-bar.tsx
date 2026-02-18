'use client';
import { Home, Calendar, MessageSquare, Trophy, User } from "lucide-react";
import Link from "next/link";
import { useDashboardState, useDashboardActions } from "@/contexts/DashboardActionsContext";
import { useChatModalStore } from "@/store/ui-store";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    notificationCount?: number;
    onClick?: () => void;
}

export default function BottomNavBar() {
    const { unreadChatCount } = useDashboardState();
    const { onOpenCalendar, onOpenChallenges, isCalendarOpen, isChallengesOpen, onCloseCalendar, onCloseChallenges } = useDashboardActions();
    const { openModal: openChatModal, isOpen: isChatOpen, closeModal: closeChatModal } = useChatModalStore();

    const navItems: NavItem[] = [
        { href: "/client/dashboard", label: "Home", icon: Home },
        { 
            href: "#", 
            label: "Calendar", 
            icon: Calendar, 
            onClick: () => isCalendarOpen ? onCloseCalendar() : onOpenCalendar()
        },
        {
            href: "#",
            label: "Chats",
            icon: MessageSquare,
            notificationCount: unreadChatCount,
            onClick: () => isChatOpen ? closeChatModal() : openChatModal(null)
        },
        { 
            href: "#", 
            label: "Challenges", 
            icon: Trophy, 
            onClick: () => isChallengesOpen ? onCloseChallenges() : onOpenChallenges() 
        },
        { href: "/client/settings", label: "Profile", icon: User },
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
                        className: "relative flex flex-col items-center justify-center text-gray-500 hover:text-primary transition-colors w-full h-full pt-1",
                        onClick: item.onClick,
                    };

                    const content = (
                        <>
                            <item.icon className="h-6 w-6" />
                            <span className="text-xs font-medium">{item.label}</span>
                            {item.notificationCount != null && item.notificationCount > 0 && (
                                <div className="absolute top-1 right-[calc(50%-2.2rem)] -translate-y-1/2 translate-x-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
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
