'use client';
import { Home, Calendar, MessageSquare, Trophy } from "lucide-react";
import Link from "next/link";
import { useDashboardActions, useDashboardState } from "@/contexts/DashboardActionsContext";
import { useChatModalStore } from "@/store/ui-store";
import { useAdBanner } from "../providers/AdBannerProvider";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    notificationCount?: number;
    onClick?: () => void;
}

export default function BottomNavBar() {
    const { unreadChatCount } = useDashboardState();
    const {
        onOpenCalendar,
        onOpenChallenges,
    } = useDashboardActions();
    const { openModal: openChatModal } = useChatModalStore();
    const { adBannerHeight } = useAdBanner();

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
    ];

    if (typeof window === 'undefined') {
        return null;
    }

    return (
        <footer 
            // CORRECTED: Reduced z-index to 40, which is below the dialog's default of 50.
            className="fixed left-0 right-0 bg-background border-t z-40 md:hidden"
            style={{ bottom: `calc(${adBannerHeight}px + env(safe-area-inset-bottom))` }}
        >
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