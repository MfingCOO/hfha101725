'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Paperclip, XCircle, FileText, Trash2, Flag } from 'lucide-react';
import { ChatMessage, ClientProfile } from '@/types';
import { postMessageAction, deleteMessageAction, uploadChatImageAction, markChatAsReadAction, getChatMessagesAction } from '@/app/chats/actions';
import { reportMessageAction } from '@/app/actions/moderation-actions';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
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
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';

function LinkifiedText({ text }: { text: string }) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <>
            {parts.map((part, i) =>
                urlRegex.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                        {part}
                    </a>
                ) : ( part )
            )}
        </>
    );
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

interface ChatViewProps {
    chatId: string | null;
}

export function ChatView({ chatId }: ChatViewProps) {
    const { user, isCoach } = useAuth();
    const { toast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<Record<string, ClientProfile>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    
    const [deleteAlertState, setDeleteAlertState] = useState<{ open: boolean, message: ChatMessage | null }>({ open: false, message: null });
    const [isDeleting, setIsDeleting] = useState(false);
    const [reportAlertState, setReportAlertState] = useState<{ open: boolean, message: ChatMessage | null }>({ open: false, message: null });
    const [isReporting, setIsReporting] = useState(false);
    
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chatId || !user) {
            setIsLoading(false);
            setMessages([]);
            setParticipants({});
            return;
        }

        markChatAsReadAction({ chatId, userId: user.uid });
    
        setIsLoading(true);
        const messagesQuery = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
        
        const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate().toISOString(),
            })) as ChatMessage[];
            
            setMessages(fetchedMessages);
            
            if (Object.keys(participants).length === 0 && chatId) {
                 const result = await getChatMessagesAction(chatId);
                 if (result.success && result.data?.participants) {
                    setParticipants(result.data.participants);
                 } else {
                    console.error("Could not load participant information:", result.error);
                    toast({ variant: "destructive", title: "Error", description: "Could not load participant information." });
                 }
            }
            
            setIsLoading(false);
    
        }, (error) => {
            console.error("Error fetching real-time messages:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load messages in real-time." });
            setIsLoading(false);
        });
    
        return () => unsubscribe();
    }, [chatId, user, toast]);
    
    
    const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior });
        }
    };

    useEffect(() => {
        if (isLoading) return;
        scrollToBottom('auto');
        const observer = new MutationObserver(() => scrollToBottom('smooth'));
        if (viewportRef.current) {
            observer.observe(viewportRef.current, { childList: true, subtree: true });
        }
        return () => observer.disconnect();
    }, [messages, isLoading]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                 toast({ variant: "destructive", title: "File Too Large", description: "Please select a file smaller than 5MB." });
                return;
            }
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
    };

    const clearFileSelection = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;
        if (!user || !chatId) return;

        setIsSending(true);
        try {
            let uploadedFileUrl: string | undefined = undefined;
            let uploadedFileName: string | undefined = undefined;

            if (selectedFile) {
                const fileDataUrl = await fileToDataUrl(selectedFile);
                const result = await uploadChatImageAction({
                    chatId,
                    fileDataUrl,
                    fileName: selectedFile.name,
                    fileType: selectedFile.type,
                    requesterId: user.uid,
                });

                if (!result.success || !result.fileUrl) {
                    throw new Error(result.error?.message || 'File upload failed.');
                }
                uploadedFileUrl = result.fileUrl;
                uploadedFileName = result.fileName;
            }
            
            const postResult = await postMessageAction({ chatId, text: newMessage, userId: user.uid, userName: user.displayName || 'Anonymous', fileUrl: uploadedFileUrl, fileName: uploadedFileName });

            if (!postResult.success) {
                throw new Error(postResult.error?.message || 'Failed to send message.');
            }

            setNewMessage('');
            clearFileSelection();
        } catch (error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message || "An unexpected error occurred." });
        } finally {
             setIsSending(false);
        }
    }
    
    const getInitials = (name: string | null | undefined) => {
        if (!name) return '?';
        const names = name.split(' ');
        if (names.length > 1) return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        return name.charAt(0).toUpperCase();
    };

    const handleDeleteMessage = async () => {
        if (!deleteAlertState.message || !user || !chatId) return;
        setIsDeleting(true);
        const { message } = deleteAlertState;
        const result = await deleteMessageAction({ chatId, messageId: message.id, requesterId: user.uid });
        if (result.success) {
            toast({ title: "Message Deleted" });
        } else {
             toast({ variant: "destructive", title: "Error", description: result.error?.message || "Failed to delete message." });
        }
        setIsDeleting(false);
        setDeleteAlertState({ open: false, message: null });
    };

    const handleReportMessage = async () => {
        if (!reportAlertState.message || !user || !chatId) return;
        setIsReporting(true);
        const { message } = reportAlertState;
        const result = await reportMessageAction(user.uid, {
            chatId,
            messageId: message.id,
            messageContent: message.text || '',
            reportedUserId: message.userId,
        });
        if (result.success) {
            toast({ title: "Message Reported", description: "Thank you for your feedback. A coach will review this message." });
        } else {
             toast({ variant: "destructive", title: "Error", description: result.error || "Failed to report message." });
        }
        setIsReporting(false);
        setReportAlertState({ open: false, message: null });
    };

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="flex flex-col h-full bg-background">
            <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
                 <div className="space-y-1 p-4">
                    {messages.map(msg => {
                        const isMyMessage = msg.userId === user?.uid;
                        const canDelete = isCoach || isMyMessage;
                        const senderProfile = participants[msg.userId];
                        return (
                        <div key={msg.id} className={cn("group flex items-center gap-2", msg.isSystemMessage && "flex-col items-center justify-center my-2", isMyMessage ? 'justify-end' : 'justify-start')}>
                            {msg.isSystemMessage ? (
                                <div className="text-xs text-center bg-muted text-muted-foreground rounded-full px-3 py-1 animate-in fade-in">{msg.text}</div>
                            ) : (
                                <>
                                {!isMyMessage && (
                                    <Avatar className="h-6 w-6 border flex-shrink-0 self-end mb-4">
                                        <AvatarImage src={senderProfile?.photoURL || ''} alt={msg.userName} />
                                        <AvatarFallback className="text-xs">{getInitials(msg.userName)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("max-w-[80%] rounded-lg px-2 py-1 min-w-0", isMyMessage ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                    <div className="text-xs break-all"><LinkifiedText text={msg.text || ''} /></div>
                                    {msg.fileUrl && (
                                        <div className="mt-1">
                                            {msg.fileName?.match(/\.pdf$/i) ? (
                                                <Link href={msg.fileUrl} target="_blank" className="flex items-center gap-2 p-1 rounded-md bg-background/20 hover:bg-background/40">
                                                    <FileText className="h-3 w-3" />
                                                    <span className="text-xs font-medium truncate max-w-[120px]">{msg.fileName || 'Shared File'}</span>
                                                </Link>
                                            ) : (
                                                <Link href={msg.fileUrl} target="_blank">
                                                    <Image src={msg.fileUrl} alt={msg.fileName || 'Shared Image'} width={100} height={100} className="rounded-md object-cover" style={{ width: '100%', height: 'auto' }} />
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                    <p className={cn("text-[10px] mt-0.5 opacity-70", isMyMessage ? 'text-right' : 'text-left')}>
                                        {msg.userName.split(' ')[0]} - {msg.timestamp ? format(new Date(msg.timestamp as any), 'MM/dd/yy, p') : ''}
                                    </p>
                                </div>
                                 <div className={cn("flex-shrink-0 self-end transition-opacity opacity-0 group-hover:opacity-100", isMyMessage && "order-first")}>
                                    {canDelete && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteAlertState({open: true, message: msg})}>
                                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                    )}
                                    {!isMyMessage && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReportAlertState({open: true, message: msg})}>
                                            <Flag className="h-3 w-3 text-muted-foreground" />
                                        </Button>
                                    )}
                                </div>
                                </>
                            )}
                        </div>
                    )})}
                </div>
            </ScrollArea>
             <div className="flex-shrink-0 bg-background border-t p-2">
                {selectedFile && (
                    <div className="flex items-center gap-2 p-1.5 mb-1 rounded-md bg-muted border animate-in fade-in-50">
                        {filePreview && <Image src={filePreview} alt="preview" width={24} height={24} className="rounded-md object-cover" />}
                        {!filePreview && <FileText className="h-6 w-6 text-muted-foreground" />}
                        <p className="text-xs text-muted-foreground flex-1 truncate">{selectedFile.name}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFileSelection}><XCircle className="h-4 w-4" /></Button>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-1">
                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending}><Paperclip className="h-4 w-4" /></Button>
                    <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a a message..." disabled={isSending} className="h-8 text-xs" />
                    <Button type="submit" size="icon" className="h-8 w-8" disabled={isSending || (!newMessage.trim() && !selectedFile)}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </div>
            <AlertDialog open={deleteAlertState.open} onOpenChange={(open) => !open && setDeleteAlertState({ open: false, message: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete this message?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteMessage} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={reportAlertState.open} onOpenChange={(open) => !open && setReportAlertState({ open: false, message: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Report this message?</AlertDialogTitle><AlertDialogDescription>This message will be flagged for review by a coach. Are you sure you want to report it?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReportMessage} disabled={isReporting}>
                            {isReporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Report
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
