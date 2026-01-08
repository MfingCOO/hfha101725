'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { getDueMessagesAction, dismissMessageAction, InAppMessage } from './actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import Image from 'next/image';

const CHECK_INTERVAL = 15 * 1000;

export function InAppMessagingManager() {
    const { user } = useAuth();
    const router = useRouter();
    const isChecking = useRef(false);

    const [messageQueue, setMessageQueue] = useState<InAppMessage[]>([]);

    const activeMessage = messageQueue.length > 0 ? messageQueue[0] : null;
    const isDialogOpen = activeMessage !== null;

    const checkForMessages = async () => {
        if (!user || isChecking.current) return;
        isChecking.current = true;

        try {
            const { success, messages, error } = await getDueMessagesAction(user.uid);
            if (success && messages && messages.length > 0) {
                setMessageQueue(prevQueue => {
                    const existingIds = new Set(prevQueue.map(m => m.id));
                    const newMessages = messages.filter(m => !existingIds.has(m.id));
                    return [...prevQueue, ...newMessages];
                });
            }
            if (error) {
                console.error("Error checking for in-app messages:", error);
            }
        } finally {
            isChecking.current = false;
        }
    };

    const handleDismiss = () => {
        if (!activeMessage) return;
        setMessageQueue(prevQueue => prevQueue.slice(1));
        if(user){
            dismissMessageAction(user.uid, activeMessage.id, activeMessage.type);
        }
    };

    const handleAction = () => {
        if (!activeMessage?.ctaUrl) return;
        router.push(activeMessage.ctaUrl);
        handleDismiss();
    };

    useEffect(() => {
        if (user) {
            checkForMessages();
            const intervalId = setInterval(checkForMessages, CHECK_INTERVAL);
            return () => clearInterval(intervalId);
        }
    }, [user]);

    // DEFINITIVE, FINAL FIX: The Dialog component is now ALWAYS rendered to prevent
    // conditional hook rendering, which was the root cause of the crash.
    // The `open` prop now solely controls visibility.
    return (
        <Dialog open={isDialogOpen} modal={false}>
            {activeMessage && (
                <DialogContent
                    className="flex flex-col p-0 border-none rounded-lg overflow-hidden shadow-2xl"
                    style={{
                        width: '90vw',
                        height: '90vh',
                        maxWidth: '800px',
                        maxHeight: '800px',
                    }}
                    onEscapeKeyDown={handleDismiss}
                    onPointerDownOutside={handleDismiss}
                >
                    <div className="flex-grow p-6 md:p-8 overflow-y-auto">
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-2xl md:text-3xl font-bold text-center">{activeMessage.title}</DialogTitle>
                        </DialogHeader>

                        <DialogDescription className="text-base md:text-lg text-center mb-6">
                            {activeMessage.message}
                        </DialogDescription>

                        {activeMessage.imageUrl && (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden my-4 shadow-lg">
                                <Image
                                    src={activeMessage.imageUrl}
                                    alt={activeMessage.title}
                                    layout="fill"
                                    objectFit="cover"
                                    unoptimized
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-auto p-4 md:p-6 flex-shrink-0 border-t bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeMessage.ctaUrl && (
                            <Button onClick={handleAction} size="lg" className="text-lg w-full">
                                {activeMessage.ctaText || 'Take Action'}
                            </Button>
                        )}
                        <Button
                            variant="secondary" 
                            onClick={handleDismiss}
                            size="lg"
                            style={{ border: 'none' }}
                            className={`text-lg w-full ${!activeMessage.ctaUrl ? 'sm:col-span-2' : ''}`}>
                            Dismiss
                        </Button>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    );
}