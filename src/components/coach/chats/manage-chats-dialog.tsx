'use client';
import { CoachPageModal } from '@/components/ui/coach-page-modal';
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { Loader2, MessageSquare, MoreVertical, Trash2, PlusCircle, LogOut } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { differenceInHours } from 'date-fns';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsAndClientsForCoach, createChatAction, deleteChatAction, joinChat, leaveChat } from '@/app/chats/actions';
import { CreateChatDialog } from './create-chat-dialog';
import type { Chat as OriginalChat, ClientProfile as OriginalClientProfile } from "@/types";

// Helper to convert string dates from server into sortable numbers
const toTimestamp = (date: string | undefined | null): number => {
    return date ? new Date(date).getTime() : 0;
};

// These types correctly represent the data shape after it's been serialized by the server action.
type SerializableChat = Omit<OriginalChat, 'createdAt' | 'lastClientMessage' | 'lastCoachMessage' | 'lastAutomatedMessage' | 'lastMessage'> & {
    createdAt?: string;
    lastClientMessage?: string;
    lastCoachMessage?: string;
    lastAutomatedMessage?: string;
    lastMessage?: string;
};
type SerializableClientProfile = Omit<OriginalClientProfile, 'createdAt'> & { createdAt?: string };


interface ManageChatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageChatsDialog({ open, onOpenChange }: ManageChatsDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [allChats, setAllChats] = useState<SerializableChat[]>([]);
    const [allClients, setAllClients] = useState<SerializableClientProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActing, setIsActing] = useState<string | null>(null);
    
    const [sortedChats, setSortedChats] = useState<{
        activeCoachingChats: SerializableChat[],
        miaCoachingChats: SerializableChat[],
        groupChats: SerializableChat[]
    }>({ activeCoachingChats: [], miaCoachingChats: [], groupChats: [] });

    const [detailDialogState, setDetailDialogState] = useState<{ open: boolean, chatInfo: {id: string, name: string} | null }>({ open: false, chatInfo: null });
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, chat: SerializableChat | null }>({ open: false, chat: null });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);

    const fetchChats = useCallback(async () => {
        setIsLoading(true);
        const result = await getChatsAndClientsForCoach();
        if (result.success && result.data) {
            setAllChats(result.data.chats as SerializableChat[]);
            setAllClients(result.data.clients as SerializableClientProfile[]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: result.error?.message || 'Could not fetch chats.'
            });
        }
        setIsLoading(false);
    }, [toast]);

    useEffect(() => {
      if(open) {
        fetchChats();
      }
    }, [open, fetchChats]);

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
            const lastClientMsgTime = toTimestamp(chat.lastClientMessage);
            const needsAttention = !chat.lastCoachMessage || (lastClientMsgTime > toTimestamp(chat.lastCoachMessage));
            const isMia = differenceInHours(now, lastClientMsgTime) >= miaThresholdHours;

            if (isMia) {
                mia.push(chat);
            } else {
                active.push(chat);
            }
        });
        
        active.sort((a, b) => toTimestamp(b.lastClientMessage) - toTimestamp(a.lastClientMessage));
        mia.sort((a, b) => toTimestamp(a.lastClientMessage) - toTimestamp(b.lastClientMessage));
        group.sort((a,b) => toTimestamp(b.lastMessage || b.createdAt) - toTimestamp(a.lastMessage || b.createdAt));

        setSortedChats({ activeCoachingChats: active, miaCoachingChats: mia, groupChats: group });

    }, [allChats, allClients, isLoading, user]);

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

    const handleDelete = async () => {
        if (!deleteAlertState.chat || !user) return;
        setIsDeleting(true);
        try {
            const result = await deleteChatAction(deleteAlertState.chat.id, user.uid);
            if (result.success) {
                toast({ title: "Success", description: "The chat has been deleted." });
                fetchChats();
            } else {
                throw new Error(result.error || "Failed to delete chat.");
            }
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setDeleteAlertState({ open: false, chat: null });
        }
    }
    
    const ChatList = ({ list, type }: { list: SerializableChat[], type: 'coaching' | 'group' }) => {
        if (list.length === 0) {
            return <p className="text-center text-muted-foreground p-8 text-sm">No chats in this category.</p>
        }
        
        const clientMap = new Map(allClients.map(c => [c.uid, c]));

        return (
             <div className="space-y-2">
                {list.map(chat => {
                    const clientParticipants = chat.participants.filter(p => !COACH_UIDS.includes(p));
                    const primaryClient = clientParticipants.length > 0 ? clientMap.get(clientParticipants[0]) : null;

                    const chatName = chat.type === 'coaching' && primaryClient ? primaryClient.fullName : chat.name;
                    const chatAvatar = chat.type === 'coaching' && primaryClient ? primaryClient.photoURL : undefined;

                    const isParticipant = user ? chat.participants.includes(user.uid) : false;
                    const isActionInProgress = isActing === chat.id;
                    
                     return (
                         <div key={chat.id} className="flex items-center gap-2 rounded-lg border p-1.5 bg-card text-card-foreground">
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
                                 <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDetailDialogState({open: true, chatInfo: { id: chat.id, name: chatName || chat.name } })}>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {type === 'group' && (
                                            isParticipant ? (
                                                <DropdownMenuItem onClick={() => handleJoinLeave(chat.id, 'leave')} disabled={isActionInProgress}>
                                                    <LogOut className="mr-2 h-4 w-4" /> Leave
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleJoinLeave(chat.id, 'join')} disabled={isActionInProgress}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Join
                                                </DropdownMenuItem>
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
                 <div className="flex justify-end w-full">
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
                <Tabs defaultValue="active" className="w-full h-full flex flex-col">
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
            )}
        </CoachPageModal>

        <CreateChatDialog
            open={isCreateChatOpen}
            onOpenChange={setIsCreateChatOpen}
            onChatCreated={fetchChats}
            clients={allClients}
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
                     {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Chat
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

// Dummy COACH_UIDS for client-side identification.
const COACH_UIDS = ['oYsf7Iah6hVlEgHvWJ7Ms7j1oTB2', 'yue7fVPBQZg45vmfXXUH5PdG7jE2'];