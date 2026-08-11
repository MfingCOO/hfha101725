'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Paperclip, XCircle, FileText, Trash2, Flag, Camera, Image as ImageIcon, Smile } from 'lucide-react';
import { ChatMessage, ClientProfile } from '@/types';
import { postMessageAction, deleteMessageAction, uploadChatImageAction, markChatAsReadAction, getChatMessagesAction, addReactionAction } from '@/app/chats/actions';
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
import { MentionsInput, Mention } from 'react-mentions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Capacitor Imports
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

// ================================================
// FIXED: FORMATTED MESSAGE (no UID, high contrast tags)
// ================================================
function FormattedMessage({ text }: { text: string }) {
    if (!text) return '';

    const mentions = new Map<string, string>();
    let mentionIndex = 0;

    // 1. Find mentions and replace them with a temporary placeholder
    let processedText = text.replace(/@\[([^\]]+)\]\([^)]+\)/g, (match, name) => {
        const placeholder = `__MENTION_${mentionIndex}__`;
        const mentionHtml = `<span class="inline-block bg-amber-300 text-black font-semibold px-1.5 py-0.5 rounded-md">@${name}</span>`;
        mentions.set(placeholder, mentionHtml);
        mentionIndex++;
        return placeholder;
    });

    // 2. Now, find URLs and wrap them in anchor tags
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    processedText = processedText.replace(urlRegex, (url) => 
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">${url}</a>`
    );

    // 3. Finally, restore the mentions from the placeholders
    mentions.forEach((html, placeholder) => {
        processedText = processedText.replace(placeholder, html);
    });

    return processedText;
}

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

const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new (window as any).Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const MAX_DIMENSION = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_DIMENSION) height *= MAX_DIMENSION / width, width = MAX_DIMENSION;
                } else {
                    if (height > MAX_DIMENSION) width *= MAX_DIMENSION / height, height = MAX_DIMENSION;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                    else resolve(file);
                }, file.type, 0.8);
            };
        };
        reader.readAsDataURL(file);
    });
};

const uriToFile = async (uri: string, fileName: string, fileType: string): Promise<File> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], fileName, { type: fileType, lastModified: Date.now() });
};

interface ChatViewProps {
    chatId: string | null;
}

const EMOJI_REACTIONS = ['👍', '🎉', '💪', '❤️', '😊', '😮'];

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
    const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
    const [mentionableUsers, setMentionableUsers] = useState<{ id: string; display: string; }[]>([]);
    const [isMentionsReady, setIsMentionsReady] = useState(false);

    useEffect(() => {
        setIsMentionsReady(false);
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
                 try {
                    const result = await getChatMessagesAction(chatId);
                    if (result.success && result.data?.participants) {
                        setParticipants(result.data.participants);
                        const usersForMentions = Object.entries(result.data.participants).map(([id, profile]) => ({
                            id: id,
                            display: profile.fullName || 'Unknown User'
                        }));
                        setMentionableUsers(usersForMentions);
                        setIsMentionsReady(true);
                    } else {
                        throw new Error(result.error || "Could not load participant information.");
                    }
                } catch (e: any) {
                     toast({ variant: "destructive", title: "Error", description: e.message });
                }
            } else {
                setIsMentionsReady(true);
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const originalFile = event.target.files?.[0];
        setShowAttachmentOptions(false);
        if (originalFile) {
            if (!originalFile.type.startsWith('image/') && originalFile.size > 5 * 1024 * 1024) {
                toast({ variant: "destructive", title: "File Too Large", description: "Please select a file smaller than 5MB." });
                return;
            }

            let fileToUpload = originalFile;

            if (originalFile.type.startsWith('image/')) {
                fileToUpload = await resizeImage(originalFile);
                if (fileToUpload.size > 5 * 1024 * 1024) {
                     toast({ variant: "destructive", title: "File Too Large", description: "Even after compression, the image is too large (max 5MB)." });
                     return;
                }
            }
            
            setSelectedFile(fileToUpload);
            if (fileToUpload.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(fileToUpload);
            } else {
                setFilePreview(null);
            }
        }
    };

    const handleCameraAction = async () => {
        setShowAttachmentOptions(false);
        if (!user) return;
        setIsSending(true);
        try {
            const photo = await CapacitorCamera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
            });

            if (photo.webPath) {
                const fileType = photo.format ? `image/${photo.format}` : 'image/jpeg';
                const fileName = `chat_camera_${Date.now()}.${photo.format || 'jpeg'}`;
                const originalFile = await uriToFile(photo.webPath, fileName, fileType);
                
                let fileToUpload = originalFile;
                if (originalFile.type.startsWith('image/')) {
                    fileToUpload = await resizeImage(originalFile);
                    if (fileToUpload.size > 5 * 1024 * 1024) {
                        toast({ variant: "destructive", title: "File Too Large", description: "Even after compression, the image is too large (max 5MB)." });
                        setIsSending(false);
                        return;
                    }
                }

                setSelectedFile(fileToUpload);
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(fileToUpload);

            } else {
                toast({ variant: "destructive", title: "Error", description: "Could not capture photo." });
            }
        } catch (error: any) {
            console.error("Error capturing photo:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to capture photo." });
        } finally {
            setIsSending(false);
        }
    };

    const handleGalleryAction = async () => {
        setShowAttachmentOptions(false);
        if (!user) return;
        setIsSending(true);
        try {
            const photo = await CapacitorCamera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Photos,
            });

            if (photo.webPath) {
                const fileType = photo.format ? `image/${photo.format}` : 'image/jpeg';
                const fileName = `chat_gallery_${Date.now()}.${photo.format || 'jpeg'}`;
                const originalFile = await uriToFile(photo.webPath, fileName, fileType);

                let fileToUpload = originalFile;
                if (originalFile.type.startsWith('image/')) {
                    fileToUpload = await resizeImage(originalFile);
                    if (fileToUpload.size > 5 * 1024 * 1024) {
                        toast({ variant: "destructive", title: "File Too Large", description: "Even after compression, the image is too large (max 5MB)." });
                        setIsSending(false);
                        return;
                    }
                }

                setSelectedFile(fileToUpload);
                const reader = new FileReader();
                reader.onloadend = () => setFilePreview(reader.result as string);
                reader.readAsDataURL(fileToUpload);

            } else {
                toast({ variant: "destructive", title: "Error", description: "No photo selected." });
            }
        } catch (error: any) {
            console.error("Error selecting photo from gallery:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to select photo from gallery." });
        } finally {
            setIsSending(false);
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
            
            const mentionRegex = /@\[([^\]]+)\]\((\S+)\)/g;
            const mentions = Array.from(newMessage.matchAll(mentionRegex)).map(match => match[2]);

            const postResult = await postMessageAction({ chatId, text: newMessage, userId: user.uid, userName: user.displayName || 'Anonymous', fileUrl: uploadedFileUrl, fileName: uploadedFileName, mentions });

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
    
    const handleAddReaction = async (messageId: string, emoji: string) => {
        if (!user || !chatId) return;
    
        const originalMessages = [...messages];
    
        setMessages(prevMessages => 
            prevMessages.map(msg => {
                if (msg.id === messageId) {
                    const reactions = { ...(msg.reactions || {}) };
                    const users = reactions[emoji] || [];
                    if (users.includes(user.uid)) {
                        reactions[emoji] = users.filter(uid => uid !== user.uid);
                    } else {
                        reactions[emoji] = [...users, user.uid];
                    }
                    return { ...msg, reactions };
                }
                return msg;
            })
        );
    
        try {
            await addReactionAction({ chatId, messageId, emoji, userId: user.uid });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save reaction." });
            setMessages(originalMessages);
        }
    };

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
                        <div key={msg.id} className={cn("group flex items-start gap-2", msg.isSystemMessage && "flex-col items-center justify-center my-2", isMyMessage ? 'justify-end' : 'justify-start')}>
                            {msg.isSystemMessage ? (
                                <div className="text-xs text-center bg-muted text-muted-foreground rounded-full px-3 py-1 animate-in fade-in">
                                    {(() => {
                                        const nameDateTimestampRegex = /^(.*?)\s*-\s*(\d{2}\/\d{2}\/\d{2},\s*\d{1,2}:\d{2}\s*(?:AM|PM))$/;
                                        const match = msg.text?.match(nameDateTimestampRegex);

                                        if (match) {
                                            if (msg.timestamp) {
                                                return format(new Date(msg.timestamp as any), 'MM/dd/yy');
                                            } else {
                                                const datePart = match[2].split(',')[0];
                                                return datePart;
                                            }
                                        }
                                        return msg.text;
                                    })()}
                                </div>
                            ) : (
                                <>
                                {!isMyMessage && (
                                    <Avatar className="h-6 w-6 border flex-shrink-0 mt-4">
                                        <AvatarImage src={senderProfile?.photoURL || ''} alt={msg.userName} />
                                        <AvatarFallback className="text-xs">{getInitials(msg.userName)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("flex gap-1 items-start", isMyMessage && "flex-row-reverse")}>
                                    <div className={cn("max-w-[calc(100vw-120px)] sm:max-w-[calc(100vw-160px)] md:max-w-[400px] rounded-lg px-2 py-1 min-w-0 overflow-hidden", isMyMessage ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                        <div className="text-xs break-words" dangerouslySetInnerHTML={{ __html: FormattedMessage({ text: msg.text || '' }) }} />

                                        {msg.fileUrl && (
                                            <div className="mt-2">
                                                {msg.fileName?.match(/\.pdf$/i) ? (
                                                    <Link 
                                                        href={msg.fileUrl} 
                                                        target="_blank" 
                                                        className="flex items-center gap-2 p-1 rounded-md bg-background/20 hover:bg-background/40"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        <span className="text-xs font-medium truncate max-w-[120px]">
                                                            {msg.fileName || 'Shared File'}
                                                        </span>
                                                    </Link>
                                                ) : (
                                                    <>
                                                        <Link 
                                                            href={msg.fileUrl} 
                                                            target="_blank" 
                                                            className="flex items-center gap-2 p-1 rounded-md bg-background/20 hover:bg-background/40"
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            <span className="text-xs font-medium truncate max-w-[120px]">
                                                                {msg.fileName || 'Shared File'}
                                                            </span>
                                                        </Link>

                                                        {msg.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                                                            <Link href={msg.fileUrl} target="_blank" className="block mt-2">
                                                                <Image 
                                                                    src={msg.fileUrl} 
                                                                    alt={msg.fileName || 'Shared Image'} 
                                                                    width={100} 
                                                                    height={100} 
                                                                    className="rounded-md object-cover w-full max-w-[220px] h-auto" 
                                                                />
                                                            </Link>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 flex-wrap mt-1">
                                            {msg.reactions && Object.entries(msg.reactions).map(([emoji, userIds]) => {
                                                if (!userIds || userIds.length === 0) return null;
                                                const isUserReacted = userIds.includes(user?.uid || '');
                                                return (
                                                    <div key={emoji} className={cn("px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1", isUserReacted ? "bg-yellow-400/30 border border-yellow-500/50" : "bg-muted-foreground/20")}>
                                                        <span>{emoji}</span>
                                                        <span>{userIds.length}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className={cn("text-[10px] mt-0.5 opacity-70 break-words", isMyMessage ? 'text-right' : 'text-left')}>
                                            {msg.userName.split(' ')[0]} - {msg.timestamp ? format(new Date(msg.timestamp as any), 'MM/dd/yy, p') : ''}
                                        </p>
                                    </div>

                                    <div className={cn("flex-shrink-0 self-start transition-opacity opacity-0 group-hover:opacity-100")}>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6"><Smile className="h-3 w-3 text-muted-foreground" /></Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-1">
                                                <div className="flex gap-1">
                                                {EMOJI_REACTIONS.map(emoji => (
                                                    <Button key={emoji} variant="ghost" size="icon" className="h-8 w-8 text-lg" onClick={() => handleAddReaction(msg.id, emoji)}>{emoji}</Button>
                                                ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

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
                                </div>
                                </>
                            )}
                        </div>
                    )})}
                </div>
            </ScrollArea>

            {/* ========== FIXED INPUT SECTION ========== */}
            <div className="flex-shrink-0 bg-background border-t p-2">
                {selectedFile && (
                    <div className="flex items-center gap-2 p-1.5 mb-1 rounded-md bg-muted border animate-in fade-in-50">
                        {filePreview && <Image src={filePreview} alt="preview" width={24} height={24} className="rounded-md object-cover" />}
                        {!filePreview && <FileText className="h-6 w-6 text-muted-foreground" />}
                        <p className="text-xs text-muted-foreground flex-1 truncate">{selectedFile.name}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFileSelection}>
                            <XCircle className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <form onSubmit={handleSendMessage} className="flex w-full items-end gap-1 relative">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                    
                    {Capacitor.isNativePlatform() && showAttachmentOptions && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover border rounded-md shadow-lg p-1 z-50">
                            <Button variant="ghost" className="w-full justify-start" onClick={handleCameraAction} disabled={isSending}>
                                <Camera className="mr-2 h-4 w-4" /> Take Photo
                            </Button>
                            <Button variant="ghost" className="w-full justify-start" onClick={handleGalleryAction} disabled={isSending}>
                                <ImageIcon className="mr-2 h-4 w-4" /> Choose from Library
                            </Button>
                        </div>
                    )}

                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 flex-shrink-0"
                        onClick={() => Capacitor.isNativePlatform() ? setShowAttachmentOptions(!showAttachmentOptions) : fileInputRef.current?.click()} 
                        disabled={isSending}
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                        {isMentionsReady && mentionableUsers.length > 1 ? (
                            <MentionsInput 
                                value={newMessage || ''}
                                onChange={(event, newValue) => setNewMessage(newValue)}
                                placeholder="Type a message..." 
                                disabled={isSending} 
                                forceSuggestionsAboveCursor={true}
                                style={{
                                    control: {
                                        fontSize: 16,
                                        minHeight: 36,
                                        maxHeight: 100,
                                        overflowY: 'auto',
                                    },
                                    input: {
                                        margin: 0,
                                        padding: '8px 12px',
                                        border: '1px solid hsl(var(--input))',
                                        borderRadius: '0.5rem',
                                        outline: 'none',
                                        minHeight: 36,
                                        maxHeight: 100,
                                        overflowY: 'auto',
                                        wordBreak: 'break-all',
                                    },
                                    highlighter: {
                                        padding: '8px 12px',
                                        border: '1px solid transparent',
                                        borderRadius: '0.5rem',
                                        minHeight: 36,
                                        maxHeight: 100,
                                        overflowY: 'auto',
                                    },
                                    suggestions: {
                                        backgroundColor: '#1e2937',
                                        border: '2px solid #64748b',
                                        borderRadius: '8px',
                                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.4)',
                                        zIndex: 99999,
                                        minWidth: '260px',
                                        maxWidth: '380px',
                                        color: '#f8fafc',
                                        fontSize: '15px',
                                        marginTop: '4px',
                                        overflow: 'hidden'
                                    }
                                }}
                                classNames={{
                                    control: "mentions__control",
                                    input: "mentions__input",
                                    suggestionsList: "p-1 max-h-[320px] overflow-auto",
                                    suggestionsItem: "px-4 py-3 text-[#f8fafc] hover:bg-blue-600 rounded-lg cursor-pointer text-[15px]",
                                    suggestionsItemFocused: "bg-blue-600 text-white",
                                    mention: "bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded font-semibold inline-block mx-px"
                                }}
                            >
                                <Mention
                                    trigger="@"
                                    data={mentionableUsers}
                                    markup="@[__display__](__id__)"
                                    displayTransform={(id, display) => `@${display}`}
                                />
                            </MentionsInput>
                        ) : (
                            <Input 
                                value={newMessage} 
                                onChange={(e) => setNewMessage(e.target.value)} 
                                placeholder="Type a message..." 
                                disabled={isSending} 
                                className="h-9 text-sm" 
                            />
                        )}
                    </div>

                    <Button 
                        type="submit" 
                        size="icon" 
                        className="h-9 w-9 flex-shrink-0" 
                        disabled={isSending || (!newMessage.trim() && !selectedFile)}
                    >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </div>
            {/* ========== END FIXED INPUT SECTION ========== */}

            <AlertDialog open={deleteAlertState.open} onOpenChange={(open) => !open && setDeleteAlertState({ open: false, message: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
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
                    <AlertDialogHeader>
                        <AlertDialogTitle>Report this message?</AlertDialogTitle>
                        <AlertDialogDescription>This message will be flagged for review by a coach. Are you sure you want to report it?</AlertDialogDescription>
                    </AlertDialogHeader>
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