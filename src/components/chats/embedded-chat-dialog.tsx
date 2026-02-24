'use client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose
} from '@/components/ui/dialog';
import { ChatView } from '@/components/chats/chat-view';
import { useEffect, useState } from 'react'; // <-- Import useState
import { useAuth } from '@/components/auth/auth-provider';
import { markChatAsRead } from '@/services/firestore';
import { useDashboardState } from '@/contexts/DashboardActionsContext';


interface EmbeddedChatDialogProps {
    chatId: string;
    chatName: string;
    isOpen: boolean;
    onClose: () => void;
}


export function EmbeddedChatDialog({ chatId, chatName, isOpen, onClose }: EmbeddedChatDialogProps) {
    const { user, isCoach } = useAuth();
    const { fetchChats } = useDashboardState();
    
    // --- THE FIX: START ---
    // Local state to control the dialog's visibility, synced with the incoming prop.
    const [isDialogOpen, setIsDialogOpen] = useState(isOpen);

    useEffect(() => {
        setIsDialogOpen(isOpen);
    }, [isOpen]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose(); // Call the original close handler when the dialog is closed by the user
        }
        setIsDialogOpen(open);
    };
    // --- THE FIX: END ---

    useEffect(() => {
        if (isDialogOpen && user && !isCoach && chatId) { // Use local state here
            markChatAsRead(user.uid, chatId).then(() => {
                if (fetchChats) {
                    fetchChats();
                }
            });
        }
    }, [isDialogOpen, user, isCoach, chatId, fetchChats]); // Use local state here
    
    return (
        // Control the dialog with the local state and the handler
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="w-[90vw] max-w-xl h-[80vh] flex flex-col p-0 gap-0">
                 <DialogHeader className="p-4 border-b text-center flex-shrink-0">
                    <DialogTitle>{chatName}</DialogTitle>
                    <DialogClose />
                </DialogHeader>

                <div className="flex-1 min-h-0">
                    <ChatView chatId={chatId} />
                </div>
            </DialogContent>
        </Dialog>
    );
}