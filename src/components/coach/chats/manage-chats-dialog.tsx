'use client';
import { CoachPageModal } from '@/components/ui/coach-page-modal';
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { Loader2, MessageSquare, MoreVertical, Trash2 } from "lucide-react";
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
import { createChatAction, deleteChatAction, getChatsAndClientsForCoach } from '@/app/chats/actions';
import { CreateChatDialog } from './create-chat-dialog';
import type { Chat as OriginalChat, ClientProfile as OriginalClientProfile } from "@/types";

// Helper to convert string dates from server into sortable numbers
const toTimestamp = (date: string | undefined | null): number => {
    return date ? new Date(date).getTime() : 0;
};

// These types correctly represent the data shape after it's been serialized by the server action.
// All Firestore Timestamps have been converted to ISO strings.
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
    
    const [sortedChats, setSortedChats] = useState<{
        activeCoachingChats: SerializableChat[],
        miaCoachingChats: SerializableChat[],
        groupChats: SerializableChat[]
    }>({ activeCoachingChats: [], miaCoachingChats: [], groupChats: [] });

    const [isClientReady, setIsClientReady] = useState(false);
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
        if (isLoading) return;

        const coaching: SerializableChat[] = [];
        const group: SerializableChat[] = [];

        allChats.forEach(chat => {
            if (chat.type === 'coaching') {
                coaching.push(chat);
            } else {
                group.push(chat);
            }
        });

        const now = new Date();
        const miaThresholdHours = 48;
        
        const active: SerializableChat[] = [];
        const mia: SerializableChat[] = [];

        coaching.forEach(chat => {
            const lastClientMsgTime = toTimestamp(chat.lastClientMessage);
            if (lastClientMsgTime > 0 && differenceInHours(now, lastClientMsgTime) < miaThresholdHours) {
                active.push(chat);
            } else {
                mia.push(chat);
            }
        });

        active.sort((a, b) => {
            const a_client = toTimestamp(a.lastClientMessage);
            const a_coach = toTimestamp(a.lastCoachMessage);
            const b_client = toTimestamp(b.lastClientMessage);
            const b_coach = toTimestamp(b.lastCoachMessage);
            
            if (a_client > a_coach && b_client <= b_coach) return -1;
            if (a_client <= a_coach && b_client > b_coach) return 1;
            if (a_client > a_coach && b_client > b_coach) return a_client - b_client;
            return a_coach - b_coach;
        });
        
        // CORRECTED SORT LOGIC FOR MIA LIST
        mia.sort((a, b) => {
            const a_last_client = toTimestamp(a.lastClientMessage);
            const b_last_client = toTimestamp(b.lastClientMessage);
            // DESCENDING order: most recent message time at the top.
            // This places the longest-inactive clients at the BOTTOM of the list.
            return b_last_client - a_last_client;
        });

        group.sort((a,b) => {
            const dateA = toTimestamp(a.lastMessage || a.createdAt);
            const dateB = toTimestamp(b.lastMessage || b.createdAt);
            return dateB - dateA;
        });

        setSortedChats({ activeCoachingChats: active, miaCoachingChats: mia, groupChats: group });
        setIsClientReady(true); 

    }, [allChats, allClients, isLoading]);


    const handleDelete = async () => {
        if (!deleteAlertState.chat || !user) return;
        setIsDeleting(true);
        try {
            // Use the original requesterId from the user object
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
    
    const ChatList = ({ list }: { list: SerializableChat[] }) => {
        if (list.length === 0) {
            return <p className="text-center text-muted-foreground p-8 text-sm">No chats in this category.</p>
        }
        
        const clientMap = new Map(allClients.map(c => [c.uid, c]));

        return (
             <div className="space-y-2">
                {list.map(chat => {
                    const clientUid = chat.type === 'coaching' ? chat.participants.find(p => !p.startsWith('coach-') && p !== user?.uid) : undefined;
                    const client = clientUid ? clientMap.get(clientUid) : null;
                    const clientName = client?.fullName || chat.name;
                    
                     return (
                         <div key={chat.id} className="flex items-center gap-2 rounded-lg border p-1.5 bg-card text-card-foreground">
                            <Avatar className="h-8 w-8 border">
                                <AvatarImage src={client?.photoURL || ''} alt={clientName || 'Chat'} />
                                <AvatarFallback>{clientName?.charAt(0) || 'C'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{clientName}</p>
                                {chat.type !== 'coaching' && (
                                     <p className="text-[10px] text-muted-foreground truncate">{chat.participantCount} members</p>
                                )}
                            </div>
                             <div className="flex items-center gap-0">
                                 <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setDetailDialogState({open: true, chatInfo: { id: chat.id, name: clientName || chat.name } })}>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
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
                    <div className="flex-1 min-h-0 mt-2">
                        {!isClientReady ? (
                             <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <>
                                <TabsContent value="active" className="h-full m-0"><ChatList list={sortedChats.activeCoachingChats} /></TabsContent>
                                <TabsContent value="mia" className="h-full m-0"><ChatList list={sortedChats.miaCoachingChats} /></TabsContent>
                                <TabsContent value="group" className="h-full m-0
                                "><ChatList list={sortedChats.groupChats} /></TabsContent>
                            </>
                        )}
                    </div>
                </Tabs>
            )}
        </CoachPageModal>

        <CreateChatDialog
            open={isCreateChatOpen}
            onOpenChange={setIsCreateChatOpen}
            onChatCreated={fetchChats}
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
