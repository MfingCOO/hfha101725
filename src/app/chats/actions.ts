'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import type { Chat, ClientProfile, ChatMessage } from '@/types';
import { z } from 'zod';
import { FieldValue, Timestamp, DocumentData } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { storage as adminStorage } from 'firebase-admin';
import { differenceInHours } from 'date-fns';
import { getMessaging } from 'firebase-admin/messaging';

const SERVER_ERROR = { success: false, error: { message: "Server configuration error." } };

// FINAL FIX: This helper function will be used to safely handle the new 'participants' type.
const getParticipantId = (p: string | ClientProfile): string => typeof p === 'string' ? p : p.uid;

async function isUserCoach(userId: string): Promise<boolean> {
    if (!adminDb || !userId) return false;
    try {
        const clientSnap = await adminDb.collection('clients').doc(userId).get();
        return clientSnap.exists && clientSnap.data()?.role === 'coach';
    } catch (error) {
        console.error(`Error checking if user ${userId} is a coach:`, error);
        return false;
    }
}

const AddFcmTokenInputSchema = z.object({
    userId: z.string(),
    token: z.string(),
});

export async function addFcmTokenAction(input: z.infer<typeof AddFcmTokenInputSchema>): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { userId, token } = AddFcmTokenInputSchema.parse(input);
        const clientRef = adminDb.collection('clients').doc(userId);

        await clientRef.set({
            fcmTokens: FieldValue.arrayUnion(token),
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to add FCM token for user ${input.userId}:`, error);
        return { success: false, error: { message: error.message || "An unknown error occurred." } };
    }
}

async function getUserProfile_Admin_Robust(userId: string): Promise<any | null> {
    if (!adminDb || !userId) return null;

    try {
        const clientRef = adminDb.collection('clients').doc(userId);
        const clientSnap = await clientRef.get();

        if (clientSnap.exists) {
            const clientData = clientSnap.data();
            return { ...clientData, uid: userId };
        }

        console.warn(`User ${userId} not found in 'clients' collection. Falling back to legacy userProfiles/coaches.`);
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const coachRef = adminDb.collection('coaches').doc(userId);

        const [userProfileSnap, coachSnap] = await Promise.all([
            userProfileRef.get(),
            coachRef.get()
        ]);

        const userProfileData = userProfileSnap.exists ? userProfileSnap.data() : {};
        const coachData = coachSnap.exists ? coachSnap.data() : {};

        const mergedProfile = { ...userProfileData, ...coachData, uid: userId };

        if (!userProfileSnap.exists && !coachSnap.exists) {
            console.error(`Could not find a profile for user ${userId} in any collection.`);
            return null;
        }

        return mergedProfile;

    } catch (error) {
        console.error(`Error merging profiles for user ${userId}:`, error);
        return null;
    }
}

function serializeTimestamps(docData: any) {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
        if (newObject[key] && typeof newObject[key].toDate === 'function') {
            newObject[key] = newObject[key].toDate().toISOString();
        } else if (key === 'dates' && newObject.dates) {
            newObject.dates = {
                from: newObject.dates.from.toDate().toISOString(),
                to: newObject.dates.to.toDate().toISOString(),
            }
        } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
            newObject[key] = serializeTimestamps(newObject[key]);
        }
    }
    return newObject;
}

export async function getChatsAndClientsForCoach(): Promise<{ 
    success: boolean; 
    data?: { 
        activeCoachingChats: Chat[], 
        miaCoachingChats: Chat[], 
        groupChats: Chat[], 
        clients: ClientProfile[], 
        coaches: ClientProfile[]
    }; 
    error?: any; 
}> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const chatsQuery = adminDb.collection('chats').orderBy('createdAt', 'desc').get();
        const clientsQuery = adminDb.collection('clients').where('tier', 'in', ['premium', 'coaching']).get();
        const coachesQuery = adminDb.collection('clients').where('role', '==', 'coach').get();
        const [chatsSnapshot, clientsSnapshot, coachesSnapshot] = await Promise.all([chatsQuery, clientsQuery, coachesQuery]);
        
        const allClients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));
        const coaches = coachesSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));
        const coachUIDs = coaches.map(c => c.uid);

        let allChats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));

        const chatsWithDataPromises = allChats.map(async (chat) => {
            const recentMessagesQuery = adminDb!.collection('chats').doc(chat.id).collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(20);

            try {
                const snapshot = await recentMessagesQuery.get();
                
                if (snapshot.empty) {
                    return { ...chat, lastMessage: undefined, lastClientMessageTimestamp: null };
                }

                const recentMessages = snapshot.docs.map(doc => doc.data());
                const lastMessageData = recentMessages[0];
                const lastMessage: ChatMessage = {
                    id: lastMessageData.id,
                    text: lastMessageData.text || (lastMessageData.fileName ? 'Attachment' : '[System Message]'),
                    timestamp: lastMessageData.timestamp || new Timestamp(0, 0),
                    senderId: lastMessageData.userId || 'system',
                    userId: lastMessageData.userId || 'system',
                    userName: lastMessageData.userName || 'System',
                    isSystemMessage: lastMessageData.isSystemMessage || false,
                };

                let lastClientMessageData: DocumentData | null = null;
                for (const msg of recentMessages) {
                    if (msg.userId && !coachUIDs.includes(msg.userId)) {
                        lastClientMessageData = msg;
                        break;
                    }
                }
                const lastClientMessageTimestamp = lastClientMessageData ? (lastClientMessageData.timestamp || null) : null;

                return { ...chat, lastMessage, lastClientMessageTimestamp };

            } catch (error) {
                console.error(`Error enhancing chat data for chat ${chat.id}:`, error);
                return { ...chat, lastMessage: undefined, lastClientMessageTimestamp: null };
            }
        });

        allChats = await Promise.all(chatsWithDataPromises);

        const now = new Date();
        const miaThresholdHours = 48;

        const coachingChats: Chat[] = [];
        const groupChats: Chat[] = [];

        allChats.forEach(chat => {
            if (chat.type === 'coaching') {
                coachingChats.push(chat);
            } else if (chat.type === 'private_group' || chat.type === 'open') {
                groupChats.push(chat);
            }
        });

        const activeCoachingChats = coachingChats.filter(chat => {
            const lastClientTimestamp = chat.lastClientMessageTimestamp 
                ? new Date((chat.lastClientMessageTimestamp as any).toDate()) 
                : null;
            return lastClientTimestamp && differenceInHours(now, lastClientTimestamp) < miaThresholdHours;
        });

        const miaCoachingChats = coachingChats.filter(chat => {
            const lastClientTimestamp = chat.lastClientMessageTimestamp 
                ? new Date((chat.lastClientMessageTimestamp as any).toDate()) 
                : null;
            return !lastClientTimestamp || differenceInHours(now, lastClientTimestamp) >= miaThresholdHours;
        });

        activeCoachingChats.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp ? (a.lastMessage.timestamp as any).toMillis() : 0;
            const timeB = b.lastMessage?.timestamp ? (b.lastMessage.timestamp as any).toMillis() : 0;
            return timeB - timeA;
        });

        miaCoachingChats.sort((a, b) => {
            const timeA = a.lastClientMessageTimestamp ? (a.lastClientMessageTimestamp as any).toMillis() : 0;
            const timeB = b.lastClientMessageTimestamp ? (b.lastClientMessageTimestamp as any).toMillis() : 0;
            return timeB - timeA;
        });

        groupChats.sort((a, b) => {
            const timeA = a.lastMessage?.timestamp ? (a.lastMessage.timestamp as any).toMillis() : 0;
            const timeB = b.lastMessage?.timestamp ? (b.lastMessage.timestamp as any).toMillis() : 0;
            return timeB - timeA;
        });

        const serializableActive = activeCoachingChats.map(serializeTimestamps);
        const serializableMia = miaCoachingChats.map(serializeTimestamps);
        const serializableGroup = groupChats.map(serializeTimestamps);
        const serializableClients = allClients.map(serializeTimestamps);
        const serializableCoaches = coaches.map(serializeTimestamps);

        return { 
            success: true, 
            data: { 
                activeCoachingChats: serializableActive as Chat[], 
                miaCoachingChats: serializableMia as Chat[],
                groupChats: serializableGroup as Chat[],
                clients: serializableClients as ClientProfile[], 
                coaches: serializableCoaches as ClientProfile[]
            } 
        };
    } catch (error: any) {
        console.error("Error fetching chats and clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

export async function getChatsForClient(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const userProfile = await getUserProfile_Admin_Robust(userId);
        const userTier = userProfile?.tier;

        const metadataSnap = await adminDb.collection('user_chat_metadata').where('userId', '==', userId).get();
        const chatMetadata: Record<string, { lastReadTimestamp: Timestamp }> = {};
        metadataSnap.forEach(doc => {
            const data = doc.data();
            if (data.lastReadTimestamp) {
                const chatId = doc.id.replace(`${userId}_`, '');
                chatMetadata[chatId] = { lastReadTimestamp: data.lastReadTimestamp };
            }
        });

        const chatPromises: Promise<any>[] = [];

        chatPromises.push(adminDb.collection('chats').where('participants', 'array-contains', userId).get());

        if (userTier === 'premium' || userTier === 'coaching') {
            chatPromises.push(adminDb.collection('chats').where('type', '==', 'open').get());
        }

        const snapshots = await Promise.all(chatPromises);
        let allChats: Chat[] = [];
        snapshots.forEach(snapshot => {
            snapshot.forEach((docSnap: any) => {
                allChats.push({ id: docSnap.id, ...docSnap.data() } as Chat);
            });
        });
        
        let uniqueChats = Array.from(new Map(allChats.map(chat => [chat.id, chat])).values());

        const chatsWithDataPromises = uniqueChats.map(async (chat) => {
            const recentMessagesQuery = adminDb!.collection('chats').doc(chat.id).collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(20);

            try {
                const snapshot = await recentMessagesQuery.get();
                
                if (snapshot.empty) {
                    return { ...chat, lastMessage: undefined, unreadCount: 0 };
                }

                const recentMessages = snapshot.docs.map(doc => doc.data());

                const lastMessageData = recentMessages[0];
                const lastMessage: ChatMessage = {
                    id: lastMessageData.id,
                    text: lastMessageData.text || (lastMessageData.fileName ? 'Attachment' : '[System Message]'),
                    timestamp: lastMessageData.timestamp || new Timestamp(0, 0),
                    senderId: lastMessageData.userId || 'system',
                    userId: lastMessageData.userId || 'system',
                    userName: lastMessageData.userName || 'System',
                    isSystemMessage: lastMessageData.isSystemMessage || false,
                };
                
                const lastReadTimestamp = chatMetadata[chat.id]?.lastReadTimestamp;
                let unreadCount = 0;

                if (lastReadTimestamp) {
                    unreadCount = recentMessages.filter(msg => 
                        msg.timestamp.toMillis() > lastReadTimestamp.toMillis() && msg.userId !== userId
                    ).length;
                } else {
                    unreadCount = recentMessages.filter(msg => msg.userId !== userId).length;
                }

                return { ...chat, lastMessage, unreadCount };

            } catch (error) {
                console.error(`Error enhancing chat data for chat ${chat.id}:`, error);
                return { ...chat, lastMessage: undefined, unreadCount: 0 };
            }
        });

        uniqueChats = await Promise.all(chatsWithDataPromises);

        const serializableData = uniqueChats.map(serializeTimestamps);
        
        serializableData.sort((a: any, b: any) => {
            const dateA = new Date(a.lastActivity || a.createdAt || "0").getTime();
            const dateB = new Date(b.lastActivity || b.createdAt || "0").getTime();
            return dateB - dateA;
        });
        
        return { success: true, data: serializableData as Chat[] };
    } catch (error: any) {
        console.error(`Error fetching user's chats (admin) for ${userId}: `, error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

export async function getChatMetadataForUser(userId: string): Promise<{ success: boolean; data?: Record<string, any>; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const metadataQuery = adminDb.collection('user_chat_metadata').where('userId', '==', userId);
        const snapshot = await metadataQuery.get();

        if (snapshot.empty) {
            return { success: true, data: {} };
        }

        const metadata: Record<string, any> = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const chatId = doc.id.replace(`${userId}_`, '');
            metadata[chatId] = serializeTimestamps(data);
        });

        return { success: true, data: metadata };
    } catch (error: any) {
        console.error(`Failed to fetch chat metadata for user ${userId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

const MarkChatAsReadInputSchema = z.object({
    chatId: z.string(),
    userId: z.string(),
});

export async function markChatAsReadAction(input: z.infer<typeof MarkChatAsReadInputSchema>): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { chatId, userId } = MarkChatAsReadInputSchema.parse(input);
        const metadataRef = adminDb.collection('user_chat_metadata').doc(`${userId}_${chatId}`);

        await metadataRef.set({
            userId: userId,
            chatId: chatId,
            lastReadTimestamp: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to mark chat ${input.chatId} as read for user ${input.userId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

export async function createCoachingChatOnFirstLogin(userId: string, userName: string): Promise<{ success: boolean; chatId?: string; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const userProfile = await getUserProfile_Admin_Robust(userId);

        if (!userProfile) {
            throw new Error('User profile not found.');
        }

        if (userProfile.hasHadCoachingChat) {
            return { success: true };
        }
        
        const coachesSnap = await adminDb.collection('clients').where('role', '==', 'coach').limit(1).get();
        if (coachesSnap.empty) {
            throw new Error("No coaches are configured in the system.");
        }
        const primaryCoachId = coachesSnap.docs[0].id;
        
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const chatRef = adminDb.collection('chats').doc();
        const participants = [userId, primaryCoachId];

        const serverTimestamp = FieldValue.serverTimestamp() as any;

        const chatData: Omit<Chat, 'id'> = {
            name: `Coaching: ${userName}`,
            description: `Private coaching chat for ${userName}.`,
            type: 'coaching',
            ownerId: primaryCoachId,
            participants,
            participantCount: participants.length,
            createdAt: serverTimestamp,
            isCoachingChat: true,
            lastActivity: serverTimestamp,
        };

        const initialMessage = {
            userId: 'system',
            userName: 'System',
            text: `This private coaching chat has been created for ${userName}.`,
            timestamp: serverTimestamp,
            isSystemMessage: true,
        };
        const messageRef = chatRef.collection('messages').doc();
        
        const batch = adminDb.batch();
        batch.set(chatRef, chatData);
        batch.set(messageRef, initialMessage);
        batch.update(userProfileRef, { 
            hasHadCoachingChat: true,
            chatIds: FieldValue.arrayUnion(chatRef.id) 
        });

        await batch.commit();
        return { success: true, chatId: chatRef.id };

    } catch (error: any) {
        console.error(`Failed to create coaching chat for user ${userId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

const UploadChatImageInputSchema = z.object({
    chatId: z.string(),
    fileDataUrl: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    requesterId: z.string(),
});

export async function uploadChatImageAction(input: z.infer<typeof UploadChatImageInputSchema>): Promise<{ success: boolean; fileUrl?: string; fileName?: string; error?: { message: string } }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { chatId, fileDataUrl, fileName, fileType, requesterId } = UploadChatImageInputSchema.parse(input);

        const chatDoc = await adminDb.collection('chats').doc(chatId).get();
        if (!chatDoc.exists) {
            return { success: false, error: { message: "Chat not found." } };
        }
        const chatData = chatDoc.data() as Chat;
        if (!chatData.participants.map(getParticipantId).includes(requesterId)) {
            return { success: false, error: { message: "You are not a member of this chat." } };
        }

        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
        const bucketName = `${serviceAccount.project_id}.appspot.com`;
        const bucket = adminStorage().bucket('hunger-free-and-happy-app.firebasestorage.app');

        const base64Content = fileDataUrl.split(';base64,').pop();
        if (!base64Content) {
            return { success: false, error: { message: "Invalid file data URL format: Missing base64 content." } };
        }
        const buffer = Buffer.from(base64Content, 'base64');
        
        const fileId = uuidv4();
        const fullFileName = `${fileId}-${fileName}`;
        const filePath = `chats/${chatId}/${fullFileName}`;
        const file = bucket.file(filePath);

        const downloadToken = uuidv4();

        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

        return { success: true, fileUrl: publicUrl, fileName: fileName };

    } catch (error: any) {
        console.error(`Error uploading chat image via server action for chat ${input.chatId}: `, error);
        return { success: false, error: { message: error.message || 'Failed to upload image.' } };
    }
}

const PostMessageInputSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  userId: z.string(),
  userName: z.string(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  mentions: z.array(z.string()).optional(),
});

export async function postMessageAction(input: z.infer<typeof PostMessageInputSchema>): Promise<{ success: boolean; error?: { message: string; }; }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { chatId, text, userId, userName, fileUrl, fileName, mentions } = PostMessageInputSchema.parse(input);
        const chatDocRef = adminDb.collection('chats').doc(chatId);
        const sentTimestamp = Timestamp.now();

        const notificationText = text ? text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1') : (fileName ? 'Sent an attachment' : 'Sent a message');

        await adminDb.runTransaction(async (transaction) => {
            const chatSnapshot = await transaction.get(chatDocRef);
            if (!chatSnapshot.exists) throw new Error("Chat does not exist.");

            const messagesCollectionRef = chatDocRef.collection('messages');
            const messageData: any = {
                userId,
                userName,
                timestamp: sentTimestamp,
                isSystemMessage: false,
                text: notificationText,
            };
            if(fileUrl) messageData.fileUrl = fileUrl;
            if(fileName) messageData.fileName = fileName;
            if(mentions && mentions.length > 0) messageData.mentions = mentions;

            transaction.set(messagesCollectionRef.doc(), messageData);

            const updateData: { [key: string]: any } = {
                lastActivity: sentTimestamp,
            };

            if (!(await isUserCoach(userId))) {
                updateData.lastClientMessageTimestamp = sentTimestamp;
            }
            
            const senderMetadataRef = adminDb!.collection('user_chat_metadata').doc(`${userId}_${chatId}`);
            transaction.set(senderMetadataRef, {
                userId: userId,
                chatId: chatId,
                lastReadTimestamp: sentTimestamp,
            }, { merge: true });

            transaction.update(chatDocRef, updateData);
        });

        console.log(`postMessageAction for chat ${chatId} finished. Notification will be handled by onNewMessage trigger.`);
        
        return { success: true };

    } catch (error: any) {
        console.error(`Critical error in postMessageAction for chat ${input.chatId}:`, error);
        if (error instanceof z.ZodError) {
            return { success: false, error: { message: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` } };
        }
        return { success: false, error: { message: error.message || `An unknown admin error occurred.` } };
    }
}

const AddReactionInputSchema = z.object({
    chatId: z.string(),
    messageId: z.string(),
    emoji: z.string(),
    userId: z.string(),
});

export async function addReactionAction(input: z.infer<typeof AddReactionInputSchema>): Promise<{ success: boolean; error?: { message: string } }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { chatId, messageId, emoji, userId } = AddReactionInputSchema.parse(input);
        const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc(messageId);

        let shouldNotify = false;
        let messageOwnerId: string | null = null;

        await adminDb.runTransaction(async (transaction) => {
            const messageDoc = await transaction.get(messageRef);
            if (!messageDoc.exists) {
                throw new Error("Message not found.");
            }

            const messageData = messageDoc.data() || {};
            messageOwnerId = messageData.userId || null;

            const reactions = messageData.reactions || {};
            const emojiUsers: string[] = reactions[emoji] || [];

            if (emojiUsers.includes(userId)) {
                // Remove reaction
                transaction.update(messageRef, {
                    [`reactions.${emoji}`]: FieldValue.arrayRemove(userId)
                });
                shouldNotify = false;
            } else {
                // Add new reaction
                transaction.update(messageRef, {
                    [`reactions.${emoji}`]: FieldValue.arrayUnion(userId)
                });
                shouldNotify = true;
            }
        });

        if (shouldNotify && messageOwnerId && messageOwnerId !== userId) {
            const authorProfile = await getUserProfile_Admin_Robust(messageOwnerId);
            if (authorProfile?.fcmTokens?.length) {
                const reactorProfile = await getUserProfile_Admin_Robust(userId);
                const reactorName = reactorProfile?.fullName || 'Someone';

                const payload = {
                    notification: {
                        title: 'New Reaction',
                        body: `${reactorName} reacted with ${emoji} to your message`,
                    },
                    data: {
                        notificationType: 'chat_reaction',
                        chatId: chatId,
                    },
                    tokens: authorProfile.fcmTokens,
                };

                await getMessaging().sendEachForMulticast(payload);
                console.log(`✅ Reaction notification sent to ${messageOwnerId} for emoji ${emoji}`);
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to add/remove reaction on message ${input.messageId}:`, error);
        if (error instanceof z.ZodError) {
            return { success: false, error: { message: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` } };
        }
        return { success: false, error: { message: error.message || "An unknown error occurred while updating the reaction." } };
    }
}

export async function joinChat(chatId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const userDocRef = adminDb.collection('clients').doc(userId);

        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists) {
                throw new Error("Chat not found.");
            }
            transaction.update(chatRef, { 
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1)
            });
            transaction.update(userDocRef, { chatIds: FieldValue.arrayUnion(chatRef.id) });
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Error joining chat ${chatId} for user ${userId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}
  
export async function leaveChat(chatId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const userDocRef = adminDb.collection('clients').doc(userId);

        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists) {
                throw new Error("Chat not found.");
            }
            transaction.update(chatRef, { 
                participants: FieldValue.arrayRemove(userId),
                participantCount: FieldValue.increment(-1)
            });
            transaction.update(userDocRef, { chatIds: FieldValue.arrayRemove(chatId) });
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Error leaving chat ${chatId} for user ${userId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

export async function getChatMessagesAction(chatId: string): Promise<{ success: boolean; data?: { messages: ChatMessage[], participants: Record<string, ClientProfile> }; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const messagesRef = chatRef.collection('messages').orderBy('timestamp', 'asc');
        
        const [chatSnap, messagesSnap] = await Promise.all([chatRef.get(), messagesRef.get()]);

        if (!chatSnap.exists) {
            throw new Error("Chat not found.");
        }
        
        const chatData = chatSnap.data() as Chat;

        const messages = messagesSnap.docs.map(doc => {
            const data = doc.data();
            return serializeTimestamps({ id: doc.id, ...data });
        });

        const participants: Record<string, ClientProfile> = {};
        if (chatData.participants && chatData.participants.length > 0) {
            const profilePromises = chatData.participants.map(p => getUserProfile_Admin_Robust(getParticipantId(p)));
            const profileSnapshots = await Promise.all(profilePromises);
            profileSnapshots.forEach(snap => {
                if (snap) { 
                    participants[snap.uid] = serializeTimestamps(snap) as ClientProfile;
                }
            });
        }

        return { success: true, data: { messages: messages as ChatMessage[], participants } };

    } catch (error: any) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

export async function getUnreadChatCountForCoach(coachId: string): Promise<{ success: boolean; count?: number; error?: any }> {
  if (!adminDb) {
      return SERVER_ERROR;
  }
  if (!(await isUserCoach(coachId))) {
      return { success: false, error: { message: "Invalid user." } };
  }

  try {
      const chatsQuery = adminDb.collection('chats').where('participants', 'array-contains', coachId).get();
      const metadataQuery = adminDb.collection('user_chat_metadata').where('userId', '==', coachId).get();

      const [chatsSnapshot, metadataSnapshot] = await Promise.all([chatsQuery, metadataQuery]);

      const lastReadTimestamps: Record<string, Date> = {};
      metadataSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.lastReadTimestamp) {
              const chatId = doc.id.replace(`${coachId}_`, '');
              lastReadTimestamps[chatId] = data.lastReadTimestamp.toDate();
          }
      });

      let unreadCount = 0;
      const chatProcessingPromises = chatsSnapshot.docs.map(async (chatDoc) => {
          const chat = { id: chatDoc.id, ...chatDoc.data() } as Chat;

          if (chat.type !== 'coaching' || (chat.mutedBy && chat.mutedBy.includes(coachId))) {
              return;
          }

          const messagesQuery = adminDb!.collection('chats').doc(chat.id).collection('messages').orderBy('timestamp', 'desc').limit(1).get();
          const lastMessageSnapshot = await messagesQuery;

          if (!lastMessageSnapshot.empty) {
              const lastMessage = lastMessageSnapshot.docs[0].data();
              
              if (lastMessage.userId && !(await isUserCoach(lastMessage.userId))) {
                  const lastReadTime = lastReadTimestamps[chat.id];
                  const lastMessageTime = lastMessage.timestamp.toDate();

                  if (!lastReadTime || lastMessageTime > lastReadTime) {
                      unreadCount++;
                  }
              }
          }
      });

      await Promise.all(chatProcessingPromises);

      return { success: true, count: unreadCount };

  } catch (error: any) {
      console.error(`Failed to get unread chat count for coach ${coachId}:`, error);
      return { success: false, error: { message: error.message } };
  }
}

const DeleteMessageInputSchema = z.object({
    messageId: z.string(),
    chatId: z.string(),
    requesterId: z.string(),
});

export async function deleteMessageAction(input: z.infer<typeof DeleteMessageInputSchema>): Promise<{ success: boolean; error?: { message: string } }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { messageId, chatId, requesterId } = DeleteMessageInputSchema.parse(input);
        const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc(messageId);
        const messageDoc = await messageRef.get();

        if (!messageDoc.exists) {
            return { success: false, error: { message: "Message not found." } };
        }

        const messageData = messageDoc.data();
        const isOwner = messageData?.userId === requesterId;
        const isCoachUser = await isUserCoach(requesterId);

        if (!isOwner && !isCoachUser) {
            return { success: false, error: { message: "You do not have permission to delete this message." } };
        }

        await messageRef.delete();
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to delete message ${input.messageId}:`, error);
        if (error instanceof z.ZodError) {
            return { success: false, error: { message: error.errors.map(e => e.message).join(', ') } };
        }
        return { success: false, error: { message: error.message || "An unknown error occurred." } };
    }
}

const CreateChatInputSchema = z.object({
    name: z.string().min(1, "Chat name cannot be empty."),
    description: z.string().optional(),
    participants: z.array(z.string()).min(1, "Chat must have at least one participant."),
    type: z.enum(['coaching', 'private_group', 'open']),
    ownerId: z.string(),
});
export async function createChatAction(input: z.infer<typeof CreateChatInputSchema>): Promise<{ success: boolean; chatId?: string; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }

    try {
        const { name, description, participants, type, ownerId } = CreateChatInputSchema.parse(input);
        const chatRef = adminDb.collection('chats').doc();

        const finalParticipants = Array.from(new Set([...participants, ownerId]));

        const chatData: Omit<Chat, 'id'> = {
            name,
            description: description || '',
            type,
            ownerId,
            participants: finalParticipants,
            participantCount: finalParticipants.length,
            createdAt: FieldValue.serverTimestamp() as any,
        };

        const batch = adminDb.batch();
        batch.set(chatRef, chatData);

        for (const userId of finalParticipants) {
            const userDocRef = adminDb.collection('clients').doc(userId);
            batch.update(userDocRef, { chatIds: FieldValue.arrayUnion(chatRef.id) });
        }

        await batch.commit();
        return { success: true, chatId: chatRef.id };
    } catch (error: any) {
        console.error(`Failed to create chat:`, error);
        if (error instanceof z.ZodError) {
            return { success: false, error: { message: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` } };
        }
        return { success: false, error: { message: error.message || "An unknown error occurred." } };
    }
}

export async function toggleChatMuteAction(input: { chatId: string, userId: string }): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { chatId, userId } = z.object({ chatId: z.string(), userId: z.string() }).parse(input);
        const chatRef = adminDb.collection('chats').doc(chatId);

        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists) {
                throw new Error("Chat not found.");
            }
            const chatData = chatDoc.data() as Chat;
            const mutedBy = chatData.mutedBy || [];
            const isMuted = mutedBy.includes(userId);

            if (isMuted) {
                transaction.update(chatRef, { mutedBy: FieldValue.arrayRemove(userId) });
            } else {
                transaction.update(chatRef, { mutedBy: FieldValue.arrayUnion(userId) });
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to toggle mute for chat ${input.chatId}:`, error);
        return { success: false, error: { message: error.message } };
    }
}

export async function deleteChatAction(input: { chatId: string, userId: string }): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }

    try {
        const { chatId, userId } = z.object({ chatId: z.string(), userId: z.string() }).parse(input);
        const chatRef = adminDb.collection('chats').doc(chatId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
            console.log(`Chat ${chatId} does not exist. No action taken.`);
            return { success: true }; // Idempotent
        }

        const chatData = chatDoc.data() as Chat;
        const participants = chatData.participants || [];
        const messagesRef = chatRef.collection('messages');
        const messagesSnapshot = await messagesRef.get();
        const batch = adminDb.batch();

        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        if (participants.length > 0) {
            for (const participant of participants) {
                const participantId = getParticipantId(participant);
                const metadataRef = adminDb.collection('user_chat_metadata').doc(`${participantId}_${chatId}`);
                batch.delete(metadataRef);
                
                const userDocRef = adminDb.collection('clients').doc(participantId);
                batch.update(userDocRef, {
                    chatIds: FieldValue.arrayRemove(chatId)
                });
            }
        }
        
        batch.delete(chatRef);

        await batch.commit();
        return { success: true };

    } catch (error: any) {
        console.error(`Failed to delete chat ${input.chatId}:`, error);
        return { success: false, error: { message: error.message || "An unknown error occurred while deleting the chat." } };
    }
}

const DismissEducationalModalSchema = z.object({
    userId: z.string(),
});

export async function dismissEducationalModal(input: z.infer<typeof DismissEducationalModalSchema>): Promise<{ success: boolean; error?: any }> {
    if (!adminDb) {
        return SERVER_ERROR;
    }
    try {
        const { userId } = DismissEducationalModalSchema.parse(input);
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        await userProfileRef.update({
            dismissedEducationalModal: true,
        });
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to mark educational modal as seen for user ${input.userId}:`, error);
        return { success: false, error: { message: error.message || "An unknown error occurred." } };
    }
}

const ConvertChatToCoachingInputSchema = z.object({
    chatId: z.string(),
});

export async function convertChatToCoachingAction(input: z.infer<typeof ConvertChatToCoachingInputSchema>): Promise<{ success: boolean; error?: { message: string } }> {
    if (!adminDb) {
        return { success: false, error: { message: "Server configuration error." } };
    }
    try {
        const { chatId } = ConvertChatToCoachingInputSchema.parse(input);
        const chatRef = adminDb.collection('chats').doc(chatId);

        await chatRef.update({
            type: 'coaching',
        });

        console.log(`Chat ${chatId} successfully converted to a coaching chat.`);
        return { success: true };
    } catch (error: any) {
        console.error(`Failed to convert chat ${input.chatId} to coaching:`, error);
        return { success: false, error: { message: error.message || "An unknown error occurred." } };
    }
}
