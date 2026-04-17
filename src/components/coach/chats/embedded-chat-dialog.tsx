'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ChatView } from '@/components/chats/chat-view';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { markChatAsRead } from '@/services/firestore';
import { useDashboardState } from '@/contexts/DashboardActionsContext';
import { getChatDetailsAction } from '@/app/coach/clients/actions';
import type { ClientProfile, Chat } from '@/types';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Loader2 } from 'lucide-react';
import { ClientDetailModal } from '../clients/client-detail-modal';

interface EmbeddedChatDialogProps {
    chatId: string;
    chatName: string;
    isOpen: boolean;
    onClose: () => void;
}

const getParticipantId = (p: string | ClientProfile): string => typeof p === 'string' ? p : p.uid;

export function EmbeddedChatDialog({ chatId, chatName, isOpen, onClose }: EmbeddedChatDialogProps) {
    const { user, isCoach } = useAuth();
    const { fetchChats } = useDashboardState();
    const [chatDetails, setChatDetails] = useState<Chat | null>(null);
    const [client, setClient] = useState<ClientProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClientDetailOpen, setIsClientDetailOpen] = useState(false);

    useEffect(() => {
        if (isOpen && user && chatId) {
            setIsLoading(true);
            if (!isCoach) {
                markChatAsRead(user.uid, chatId).then(() => {
                    if (fetchChats) fetchChats();
                });
            }

            getChatDetailsAction(chatId).then(result => {
                if (result.success && result.data) {
                    const chatData = result.data as Chat;
                    setChatDetails(chatData);
                    
                    const clientParticipant = (chatData.participants || []).find(p => getParticipantId(p) !== user.uid);
                    
                    if (clientParticipant && typeof clientParticipant !== 'string') {
                        setClient(clientParticipant as ClientProfile);
                    }
                }
                setIsLoading(false);
            });
        }
    }, [isOpen, user, isCoach, chatId, fetchChats]);

    const showCoachingTools = isCoach && chatDetails?.coachingToolsEnabled;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[90vw] max-w-xl h-[80vh] flex flex-col p-0 gap-0">
                    {/* FINAL FIX: Correctly structured header with proper positioning for the button */}
                    <DialogHeader className="p-4 border-b flex-shrink-0 flex items-center justify-between relative">
                        {/* Left spacer to help center the title */}
                        <div className="w-10"></div>
                        
                        <DialogTitle className="text-center flex-1 truncate">{chatName}</DialogTitle>

                        {/* Right-aligned container for the button */}
                        <div className="w-10 flex justify-end">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                showCoachingTools && client && (
                                    <Button variant="ghost" size="icon" onClick={() => setIsClientDetailOpen(true)} title="Open At-a-Glance">
                                        <LayoutDashboard className="h-5 w-5" />
                                    </Button>
                                )
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 min-h-0">
                        <ChatView chatId={chatId} />
                    </div>
                </DialogContent>
            </Dialog>

            {client && (
                <ClientDetailModal
                    client={client}
                    isOpen={isClientDetailOpen}
                    onClose={() => setIsClientDetailOpen(false)}
                />
            )}
        </>
    );
}
