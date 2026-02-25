'use client';
import { CoachPageModal } from '@/components/ui/coach-page-modal';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, MessageSquare, MoreVertical, Trash2, PlusCircle, LogOut, BellOff, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { MiaMessageDialog } from './MiaMessageDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { differenceInHours } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsAndClientsForCoach, toggleChatMuteAction, markChatAsReadAction, getChatMetadataForUser, createChatAction, deleteChatAction, joinChat, leaveChat } from '@/app/chats/actions';
import { CreateChatDialog } from './create-chat-dialog';
import type { Chat as OriginalChat, ClientProfile as OriginalClientProfile } from "@/types";
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

// Dummy COACH_UIDS for client-side identification.
const COACH_UIDS = ['oYsf7Iah6hVlEgHvWJ7Ms7j1oTB2', 'yue7fVPBQZg45vmfXXUH5PdG7jE2'];

type SerializableChat = Omit<OriginalChat, 'createdAt' | 'lastMessage' | 'lastClientMessageTimestamp'> & {
    id: string;
    createdAt?: string;
    lastMessage?: { text: string; timestamp: string; senderId: string };
    lastClientMessageTimestamp?: string;
};
type SerializableClientProfile = Omit<OriginalClientProfile, 'createdAt'> & { createdAt?: string };
type ChatMetadata = Record<string, { lastReadTimestamp: string }>;

interface ManageChatsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}  

export function ManageChatsDialog({ open, onOpenChange }: ManageChatsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [allChats, setAllChats] = useState<SerializableChat[]>([]);
    const [allClients, setAllClients] = useState<SerializableClientProfile[]>([]);
    const [chatMetadata, setChatMetadata] = useState<ChatMetadata>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isActing, setIsActing] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [videoCallLink, setVideoCallLink] = useState<string | null>(null);
    
    const [sortedChats, setSortedChats] = useState<{
        activeCoachingChats: SerializableChat[],
        miaCoachingChats: SerializableChat[],
        groupChats: SerializableChat[]
    }>({ activeCoachingChats: [], miaCoachingChats: [], groupChats: [] });
    const [miaChatIds, setMiaChatIds] = useState<string[]>([]);

    const [detailDialogState, setDetailDialogState] = useState<{ open: boolean, chatInfo: {id: string, name: string} | null }>({ open: false, chatInfo: null });
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, chat: SerializableChat | null }>({ open: false, chat: null });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
    const [isMiaMessageOpen, setIsMiaMessageOpen] = useState(false);

    const fetchChats = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        const [chatsResult, metadataResult] = await Promise.all([
            getChatsAndClientsForCoach(),
            getChatMetadataForUser(user.uid)
        ]);

        if (chatsResult.success && chatsResult.data) {
            setAllChats(chatsResult.data.chats as SerializableChat[]);
            setAllClients(chatsResult.data.clients as SerializableClientProfile[]);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: chatsResult.error?.message || 'Could not fetch chats.' });
        }

        if (metadataResult.success && metadataResult.data) {
            setChatMetadata(metadataResult.data);
        } else {
            console.error("Could not fetch chat metadata:", metadataResult.error);
        }

        setIsLoading(false);
    }, [toast, user]);

    useEffect(() => {
      if(open) {
        fetchChats();
        getSiteSettingsAction().then(result => {
            if (result.success && result.data?.videoCallLink) {
                setVideoCallLink(result.data.videoCallLink);
            }
        });
      } else {
          setVideoCallLink(null);
      }
    }, [open, fetchChats]);

    const clientMap = useMemo(() => new Map(allClients.map(c => [c.uid, c])), [allClients]);

    useEffect(() => {
        if (isLoading || !user) return;

        const coaching: SerializableChat[] = [];
        const group: SerializableChat[] = [];

        allChats.forEach(chat => {
            if (chat.type === 'coaching') {
                coaching.push(chat);
            } else if (chat.type === 'private_group' || chat.type === 'open') {
                group.push(chat);
            }
        });

        const now = new Date();
        const miaThresholdHours = 48;
        
        const active: SerializableChat[] = [];
        const mia: SerializableChat[] = [];

        coaching.forEach(chat => {
            const lastClientTimestamp = chat.lastClientMessageTimestamp ? new Date(chat.lastClientMessageTimestamp) : null;
            if (lastClientTimestamp && differenceInHours(now, lastClientTimestamp) < miaThresholdHours) {
                active.push(chat);
            } else {
                mia.push(chat);
            }
        });

        const filterChats = (chat: SerializableChat) => {
            const lowerCaseQuery = searchQuery.toLowerCase();
            if (!lowerCaseQuery) return true;
            if (chat.type === 'coaching') {
                const clientParticipants = chat.participants.filter(p => !COACH_UIDS.includes(p));
                const primaryClient = clientParticipants.length > 0 ? clientMap.get(clientParticipants[0]) : null;
                const chatName = primaryClient ? primaryClient.fullName : chat.name;
                return chatName?.toLowerCase().includes(lowerCaseQuery) ?? false;
            } else {
                return chat.name?.toLowerCase().includes(lowerCaseQuery) ?? false;
            }
        };
        
        const sortActiveFn = (a: SerializableChat, b: SerializableChat) => {
            const aNeedsReply = a.lastMessage && !COACH_UIDS.includes(a.lastMessage.senderId);
            const bNeedsReply = b.lastMessage && !COACH_UIDS.includes(b.lastMessage.senderId);
        
            if (aNeedsReply && !bNeedsReply) return -1;
            if (!aNeedsReply && bNeedsReply) return 1;
        
            const aTime = new Date(a.lastMessage?.timestamp || a.createdAt || 0).getTime();
            const bTime = new Date(b.lastMessage?.timestamp || b.createdAt || 0).getTime();
            return bTime - aTime;
        };
        
        const sortMiaFn = (a: SerializableChat, b: SerializableChat) =>
            new Date(a.lastMessage?.timestamp || a.createdAt || 0).getTime() -
            new Date(b.lastMessage?.timestamp || b.createdAt || 0).getTime();

        const sortGroupFn = (a: SerializableChat, b: SerializableChat) =>
            new Date(b.lastMessage?.timestamp || b.createdAt || 0).getTime() -
            new Date(a.lastMessage?.timestamp || a.createdAt || 0).getTime();

        const filteredMia = mia.filter(filterChats).sort(sortMiaFn);
        
        setSortedChats({ 
            activeCoachingChats: active.filter(filterChats).sort(sortActiveFn), 
            miaCoachingChats: filteredMia, 
            groupChats: group.filter(filterChats).sort(sortGroupFn) 
        });
        setMiaChatIds(filteredMia.map(chat => chat.id));

    }, [allChats, allClients, isLoading, user, searchQuery, clientMap, chatMetadata]);

    const handleJoinLeave = async (chatId: string, action: 'join' | 'leave') => {
        if (!user) return;
        setIsActing(chatId);
        const actionFunc = action === 'join' ? joinChat : leaveChat;
        const result = await actionFunc(chatId, user.uid);
        if (result.success) {
            toast({ title: 'Success', description: `Successfully ${action}ed the chat.` });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsActing(null);
    }

    const handleToggleMute = async (chatId: string) => {
        if (!user) return;
        setIsActing(chatId);
        const result = await toggleChatMuteAction({ chatId, coachId: user.uid });
        if (result.success) {
            toast({ title: "Success", description: "Notification settings updated." });
            fetchChats();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsActing(null);
    };

    const handleOpenChat = async (chat: SerializableChat, chatName: string) => {
        if (!user) return;
        await markChatAsReadAction({ chatId: chat.id, userId: user.uid });
        setChatMetadata(prev => ({ ...prev, [chat.id]: { lastReadTimestamp: new Date().toISOString() } }));
        setDetailDialogState({ open: true, chatInfo: { id: chat.id, name: chatName } });
    };

    const handleDelete = async () => {
        if (!deleteAlertState.chat || !user) return;
        setIsDeleting(true);
        const result = await deleteChatAction(deleteAlertState.chat.id, user.uid);
        if (result.success) {
            toast({ title: "Success", description: "The chat has been deleted." });
            fetchChats();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setIsDeleting(false);
        setDeleteAlertState({ open: false, chat: null });
    }
    
    const ChatList = ({ list, type }: { list: SerializableChat[], type: 'coaching' | 'group' }) => {
        if (list.length === 0) {
            return <p className="text-center text-muted-foreground p-8 text-sm">No chats found matching your search.</p>
        }
        
        return (
             <div className="space-y-2">
                {list.map(chat => {
                    const clientParticipants = chat.participants.filter(p => !COACH_UIDS.includes(p));
                    const primaryClient = clientParticipants.length > 0 ? clientMap.get(clientParticipants[0]) : null;
                    const chatName = chat.type === 'coaching' && primaryClient ? primaryClient.fullName : chat.name;
                    const chatAvatar = chat.type === 'coaching' && primaryClient ? primaryClient.photoURL : undefined;

                    if (!user) return null;

                    const isParticipant = chat.participants.includes(user.uid);
                    const isMuted = chat.mutedBy?.includes(user.uid) ?? false;

                    const needsReply = chat.lastMessage?.senderId && !COACH_UIDS.includes(chat.lastMessage.senderId) && !isMuted;

                    return (
                         <div key={chat.id} className="flex items-center gap-2 rounded-lg border p-1.5 bg-card text-card-foreground">
                            <div className="w-2 h-2">
                                {needsReply && <div className="h-2 w-2 rounded-full bg-red-500" />}
                            </div>
                            <Avatar className="h-8 w-8 border">
                                <AvatarImage src={chatAvatar || ''} alt={chatName || 'Chat'} />
                                <AvatarFallback>{chatName?.charAt(0) || 'C'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{chatName}</p>
                                {chat.type !== 'coaching' && (
                                     <p className="text-[10px] text-muted-foreground truncate">{chat.participantCount} members</p>
                                )}
                            </div>
                             <div className="flex items-center gap-0">
                                 <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenChat(chat, chatName || chat.name)}>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleToggleMute(chat.id)} disabled={isActing === chat.id}>
                                            {isMuted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />} 
                                            {isMuted ? 'Unmute' : 'Mute'}
                                        </DropdownMenuItem>
                                        {type === 'group' && (
                                            isParticipant ? (
                                                <DropdownMenuItem onClick={() => handleJoinLeave(chat.id, 'leave')} disabled={isActing === chat.id}><LogOut className="mr-2 h-4 w-4" /> Leave</DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleJoinLeave(chat.id, 'join')} disabled={isActing === chat.id}><PlusCircle className="mr-2 h-4 w-4" /> Join</DropdownMenuItem>
                                            )
                                        )}
                                        <DropdownMenuItem onClick={() => setDeleteAlertState({ open: true, chat })} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <>
        <CoachPageModal
            open={open}
            onOpenChange={onOpenChange}
            title="Manage Chats"
            description="Review and manage all client and group conversations."
            footer={
                 <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                        {videoCallLink && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(videoCallLink, '_blank', 'noopener,noreferrer')}
                            >
                                Meeting Chat
                            </Button>
                        )}
                         <Button variant="outline" size="sm" onClick={() => setIsMiaMessageOpen(true)}>
                            MIA Message
                        </Button>
                    </div>
                    <Button onClick={() => setIsCreateChatOpen(true)} size="sm">
                        Create New Chat
                    </Button>
                </div>
            }
        >
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            ) : (
                <div className="w-full h-full flex flex-col">
                     <div className="mb-4">
                        <Input 
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Tabs defaultValue="active" className="w-full flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="active">Active ({sortedChats.activeCoachingChats.length})</TabsTrigger>
                            <TabsTrigger value="mia">MIA ({sortedChats.miaCoachingChats.length})</TabsTrigger>
                            <TabsTrigger value="group">Group ({sortedChats.groupChats.length})</TabsTrigger>
                        </TabsList>
                        <div className="flex-1 min-h-0 mt-2 overflow-y-auto">
                            <TabsContent value="active" className="h-full m-0"><ChatList list={sortedChats.activeCoachingChats} type="coaching" /></TabsContent>
                            <TabsContent value="mia" className="h-full m-0"><ChatList list={sortedChats.miaCoachingChats} type="coaching" /></TabsContent>
                            <TabsContent value="group" className="h-full m-0"><ChatList list={sortedChats.groupChats} type="group" /></TabsContent>
                        </div>
                    </Tabs>
                 </div>
            )}
        </CoachPageModal>

        <CreateChatDialog
            open={isCreateChatOpen}
            onOpenChange={setIsCreateChatOpen}
            onChatCreated={fetchChats}
            clients={allClients}
        />
        
        <MiaMessageDialog 
            open={isMiaMessageOpen} 
            onOpenChange={setIsMiaMessageOpen}
            miaChatIds={miaChatIds}
        />

         {detailDialogState.chatInfo && (
            <EmbeddedChatDialog
                chatId={detailDialogState.chatInfo.id}
                chatName={detailDialogState.chatInfo.name}
                isOpen={detailDialogState.open}
                onClose={() => setDetailDialogState({ open: false, chatInfo: null })}
            />
        )}
        <AlertDialog open={deleteAlertState.open} onOpenChange={() => setDeleteAlertState({ open: false, chat: null })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the chat "{deleteAlertState.chat?.name}". This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                     {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}                    Delete Chat
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}