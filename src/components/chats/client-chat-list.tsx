'use client';

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "../ui/button";
import { Loader2, MoreVertical, LogOut, CalendarPlus } from "lucide-react";
import type { Chat, Challenge } from "@/services/firestore";
import { Badge } from "../ui/badge";
import { EmbeddedChatDialog } from "../coach/chats/embedded-chat-dialog";
import { getChallengesForCoach } from "@/app/coach/actions";
import { joinChat, leaveChat, markChatAsReadAction } from "@/app/chats/actions";
import { useToast } from "@/hooks/use-toast";
import { TIER_ACCESS, UserTier } from "@/types";
import { UpgradeModal } from "../modals/upgrade-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookingDialog } from "../client/booking/BookingDialog";
import { useDashboardState } from "@/contexts/DashboardActionsContext";

// Helper to convert Firestore Timestamps to ISO strings for client-side use
function serializeTimestamps(data: any): any {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(item => serializeTimestamps(item));
    }
    if (typeof data === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in data) {
            const value = data[key];
            if (value && typeof value.toDate === 'function') {
                newObj[key] = value.toDate().toISOString();
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = serializeTimestamps(value); // Recurse for nested objects
            } else {
                newObj[key] = value;
            }
        }
        return newObj;
    }
    return data;
}

// Corrected type for client-side chat objects after serialization
type SerializableChat = Omit<Chat, 'createdAt' | 'lastMessage' | 'unreadCount'> & {
    createdAt?: string;
    lastMessage?: {
        text: string;
        senderId: string;
        timestamp: string;
    };
    unreadCount?: number; // Added unreadCount to the type
};


export function ClientChatList() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const { chats, fetchChats } = useDashboardState(); // Removed chatMetadata as it's no longer needed here
    const { toast } = useToast();
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    
    const [selectedChat, setSelectedChat] = useState<{ id: string; name: string } | null>(null);
    const [upgradeModal, setUpgradeModal] = useState<{ isOpen: boolean; requiredTier: UserTier } | null>(null);
    const [joinAlert, setJoinAlert] = useState<{ isOpen: boolean; chat: SerializableChat | null }>({ isOpen: false, chat: null });
    const [leaveAlert, setLeaveAlert] = useState<{ isOpen: boolean; chat: SerializableChat | null }>({ isOpen: false, chat: null });
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    
    const serializedChats: SerializableChat[] = useMemo(() => serializeTimestamps(chats || []), [chats]);

    const { myChats, availableChats } = useMemo(() => {
        const myChats = serializedChats.filter((chat) => chat.participants.includes(user?.uid || ''));
        const availableChats = serializedChats.filter((chat) => !chat.participants.includes(user?.uid || '') && chat.type === 'open');
        return { myChats, availableChats };
    }, [serializedChats, user]);

    const handleOpenChat = (chat: SerializableChat) => {
        if (user && chat.unreadCount && chat.unreadCount > 0) {
            markChatAsReadAction({ chatId: chat.id, userId: user.uid });
        }
        setSelectedChat({ id: chat.id, name: chat.name });
    };
    
    const handleJoinClick = (chat: SerializableChat) => {
        const requiredTier = 'premium';
        const currentTierIndex = userProfile ? TIER_ACCESS.indexOf(userProfile.tier) : 0;
        const requiredTierIndex = TIER_ACCESS.indexOf(requiredTier as UserTier);

        if (currentTierIndex < requiredTierIndex) {
            setUpgradeModal({ isOpen: true, requiredTier: requiredTier as UserTier });
        } else {
            setJoinAlert({ isOpen: true, chat });
        }
    };
    
    const handleConfirmJoin = async () => {
        if (!joinAlert.chat || !user) return;
        
        setIsJoining(true);
        const result = await joinChat(joinAlert.chat.id, user.uid);
        
        if (result.success) {
            toast({ title: "Welcome!", description: `You have successfully joined the "${joinAlert.chat.name}" chat.` });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || "Could not join chat." });
        }

        setIsJoining(false);
        setJoinAlert({ isOpen: false, chat: null });
    };

    const handleConfirmLeave = async () => {
        if (!leaveAlert.chat || !user) return;

        setIsLeaving(true);
        const result = await leaveChat(leaveAlert.chat.id, user.uid);

        if (result.success) {
            toast({ title: "Chat Left", description: `You have left "${leaveAlert.chat.name}".` });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error || "Could not leave chat." });
        }

        setIsLeaving(false);
        setLeaveAlert({ isOpen: false, chat: null });
    };

    if (authLoading) {
        return (
            <div className="flex h-full items-center justify-center p-24">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    const ChatListItem = ({ chat }: { chat: SerializableChat }) => (
        <div 
            onClick={() => handleOpenChat(chat)}
            className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors flex items-center gap-3 cursor-pointer"
        >
            <div className="flex-1 min-w-0">
                <p className="font-semibold">{chat.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{chat.description || 'No description.'}</p>
            </div>
            <div className="flex items-center gap-2">
                {chat.unreadCount != null && chat.unreadCount > 0 && (
                    <Badge variant="destructive">{chat.unreadCount}</Badge>
                )}
                <Button 
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={(e) => { e.stopPropagation(); handleOpenChat(chat); }}
                >
                    {isLoadingDetails ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Open'}
                </Button>
                {chat.type !== 'coaching' && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setLeaveAlert({ isOpen: true, chat }); }}>
                                <LogOut className="mr-2 h-4 w-4" /> Leave Chat
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );

    return (
        <>
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">My Chats</h2>
                 {userProfile?.tier === 'coaching' && (
                    <Button onClick={() => setIsBookingOpen(true)} size="sm" variant="outline">
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Book a Call
                    </Button>
                )}
            </div>
            {myChats.length > 0 ? (
                <div className="space-y-3">
                    {myChats.map(chat => (
                        <ChatListItem 
                            key={chat.id} 
                            chat={chat}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Your conversations will appear here once you join a chat or get coaching.</p>
            )}

            {availableChats.length > 0 && (
                 <div className="space-y-4 pt-8">
                    <h2 className="text-2xl font-bold tracking-tight">Discover Open Chats</h2>
                     <div className="space-y-3">
                        {availableChats.map(chat => (
                             <div key={chat.id} className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted transition-colors flex flex-col items-start gap-2 disabled:opacity-50">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{chat.name}</p>
                                        {chat.type === 'challenge' && <Badge variant="secondary">Challenge</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{chat.description || 'No description.'}</p>
                                </div>
                                <div className="w-full pt-2 border-t border-white/10">
                                     <Button onClick={() => handleJoinClick(chat)} size="sm" className="w-full">
                                        Join Chat
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {selectedChat && (
            <EmbeddedChatDialog 
                isOpen={!!selectedChat}
                onClose={() => {
                  setSelectedChat(null);
                  fetchChats(); // Refetch when closing a chat to update read status
                }}
                chatId={selectedChat.id}
                chatName={selectedChat.name}
            />
        )}
        
        {upgradeModal && (
            <UpgradeModal
                isOpen={upgradeModal.isOpen}
                onClose={() => setUpgradeModal(null)}
                requiredTier={upgradeModal.requiredTier}
                featureName="Community Chats"
                reason="Connect with the community and get extra motivation!"
            />
        )}
        {joinAlert.chat && (
            <AlertDialog open={joinAlert.isOpen} onOpenChange={() => setJoinAlert({ isOpen: false, chat: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Join "{joinAlert.chat.name}"</AlertDialogTitle>
                        <AlertDialogDescription>Please review the chat rules before joining:</AlertDialogDescription>
                        <div className="text-sm text-muted-foreground pt-2 text-left max-h-40 overflow-y-auto">
                            <ul className="list-disc pl-5 space-y-1">
                                {(joinAlert.chat.rules || ['Be respectful and supportive.']).map((rule, i) => <li key={i}>{rule}</li>)}
                            </ul>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmJoin} disabled={isJoining}>
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Agree & Join
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
         {leaveAlert.chat && (
            <AlertDialog open={leaveAlert.isOpen} onOpenChange={() => setLeaveAlert({ isOpen: false, chat: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave "{leaveAlert.chat.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>You will be removed from this chat and will no longer receive messages. Are you sure?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmLeave} disabled={isLeaving} className="bg-destructive hover:bg-destructive/90">
                            {isLeaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Leave Chat
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        <BookingDialog
            isOpen={isBookingOpen}
            onClose={() => setIsBookingOpen(false)}
        />
        </>
    )
}
