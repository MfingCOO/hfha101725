'use server';

import { db as adminDb, messaging } from '@/lib/firebaseAdmin';
import type { Chat, UserProfile, ClientProfile, ChatMessage } from '@/types';
import { z } from 'zod';
import { COACH_UIDS } from '@/lib/coaches';
import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore';

const SERVER_ERROR = { success: false, error: "Server configuration error." };

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

export async function getChatsAndClientsForCoach(): Promise<{ success: boolean; data?: { chats: Chat[], clients: ClientProfile[] }; error?: any; }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in getChatsAndClientsForCoach.");
        return SERVER_ERROR;
    }
    try {
        const chatsQuery = adminDb.collection('chats').orderBy('createdAt', 'desc').get();
        const clientsQuery = adminDb.collection('userProfiles').where('tier', 'in', ['premium', 'coaching']).get();
        const [chatsSnapshot, clientsSnapshot] = await Promise.all([chatsQuery, clientsQuery]);
        
        let allChats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        const allClients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));

        const chatsWithDataPromises = allChats.map(async (chat) => {
            const recentMessagesQuery = adminDb!.collection('chats').doc(chat.id).collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(20);

            try {
                const snapshot = await recentMessagesQuery.get();
                
                if (snapshot.empty) {
                    return { ...chat, lastMessage: null, lastClientMessageTimestamp: null };
                }

                const recentMessages = snapshot.docs.map(doc => doc.data());
                const lastMessageData = recentMessages[0];
                const lastMessage = {
                    text: lastMessageData.text || (lastMessageData.fileName ? 'Attachment' : '[System Message]'),
                    timestamp: lastMessageData.timestamp || new Timestamp(0, 0),
                    senderId: lastMessageData.userId || 'system'
                };

                const lastClientMessageData = recentMessages.find(msg => msg.userId && !COACH_UIDS.includes(msg.userId));
                const lastClientMessageTimestamp = lastClientMessageData ? (lastClientMessageData.timestamp || null) : null;

                return { ...chat, lastMessage, lastClientMessageTimestamp };

            } catch (error) {
                console.error(`Error enhancing chat data for chat ${chat.id}:`, error);
                return { ...chat, lastMessage: null, lastClientMessageTimestamp: null };
            }
        });

        allChats = await Promise.all(chatsWithDataPromises);
        const serializableChats = allChats.map(serializeTimestamps);
        const serializableClients = allClients.map(serializeTimestamps);

        return { success: true, data: { chats: serializableChats as Chat[], clients: serializableClients as ClientProfile[] } };
    } catch (error: any) {
        console.error("Error fetching chats and clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

export async function getChatsForClient(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in getChatsForClient.");
        return SERVER_ERROR;
    }
    try {
        const userProfileSnap = await adminDb.collection('userProfiles').doc(userId).get();
        if (!userProfileSnap.exists) {
            return { success: true, data: [] };
        }
        
        const userProfile = userProfileSnap.data() as UserProfile;
        const userChatIds = userProfile.chatIds || [];
        const userTier = userProfile.tier;

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

        if (userChatIds.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < userChatIds.length; i += 30) {
                chunks.push(userChatIds.slice(i, i + 30));
            }
            chunks.forEach(chunk => {
                chatPromises.push(adminDb!.collection('chats').where(FieldPath.documentId(), 'in', chunk).get());
            });
        }

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
                    return { ...chat, lastMessage: null, unreadCount: 0 };
                }

                const recentMessages = snapshot.docs.map(doc => doc.data());

                const lastMessageData = recentMessages[0];
                const lastMessage = {
                    text: lastMessageData.text || (lastMessageData.fileName ? 'Attachment' : '[System Message]'),
                    timestamp: lastMessageData.timestamp || new Timestamp(0, 0),
                    senderId: lastMessageData.userId || 'system'
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
                return { ...chat, lastMessage: null, unreadCount: 0 };
            }
        });

        uniqueChats = await Promise.all(chatsWithDataPromises);

        const serializableData = uniqueChats.map(serializeTimestamps);
        
        serializableData.sort((a: any, b: any) => {
            const dateA = new Date(a.lastMessage?.timestamp || a.createdAt || "0").getTime();
            const dateB = new Date(b.lastMessage?.timestamp || b.createdAt || "0").getTime();
            return dateB - dateA;
        });
        
        return { success: true, data: serializableData as Chat[] };
    } catch (error: any) {
        console.error("Error fetching user's chats (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

export async function getChatMetadataForUser(userId: string): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in getChatMetadataForUser.");
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
        return { success: false, error: error.message };
    }
}

const MarkChatAsReadInputSchema = z.object({
    chatId: z.string(),
    userId: z.string(),
});

export async function markChatAsReadAction(input: z.infer<typeof MarkChatAsReadInputSchema>) {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in markChatAsReadAction.");
        return SERVER_ERROR;
    }
    const { chatId, userId } = MarkChatAsReadInputSchema.parse(input);
    const metadataRef = adminDb.collection('user_chat_metadata').doc(`${userId}_${chatId}`);

    try {
        await metadataRef.set({
            userId: userId,
            chatId: chatId,
            lastReadTimestamp: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to mark chat ${chatId} as read for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function createCoachingChatOnFirstLogin(userId: string, userName: string): Promise<{ success: boolean; chatId?: string; error?: string }> {
    if (!adminDb || !messaging) {
        console.error("CRITICAL: Firebase Admin is not initialized in createCoachingChatOnFirstLogin.");
        return SERVER_ERROR;
    }
    try {
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
            throw new Error('User profile not found.');
        }

        const userProfile = userProfileSnap.data() as UserProfile;
        
        if (userProfile.hasHadCoachingChat) {
            return { success: true };
        }
        
        const primaryCoachId = COACH_UIDS[0];
        if (!primaryCoachId) {
            throw new Error("No coaches are configured.");
        }

        const chatRef = adminDb.collection('chats').doc();
        const participants = [userId, primaryCoachId];

        const chatData: Omit<Chat, 'id'> = {
            name: `Coaching: ${userName}`,
            description: `Private coaching chat for ${userName}.`,
            type: 'coaching',
            ownerId: primaryCoachId,
            participants,
            participantCount: participants.length,
            createdAt: FieldValue.serverTimestamp() as any,
        };

        const sentTimestamp = FieldValue.serverTimestamp();
        const initialMessage = {
            userId: 'system',
            userName: 'System',
            text: `This private coaching chat has been created for ${userName}.`,
            timestamp: sentTimestamp,
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

        const coachProfileSnap = await adminDb.collection('userProfiles').doc(primaryCoachId).get();
        if (coachProfileSnap.exists) {
            const coachData = coachProfileSnap.data();
            if (coachData && coachData.fcmTokens && coachData.fcmTokens.length > 0) {
                const validTokens = coachData.fcmTokens.filter((t: any) => t);
                if (validTokens.length > 0) {
                    const payload = {
                        tokens: validTokens,
                        data: {
                            chatId: String(chatRef.id),
                            sent_time: String(Date.now()),
                            notificationType: 'chat'
                        },
                        notification: {
                            title: `New Coaching Chat`,
                            body: `A new coaching chat has been created for ${userName}.`
                        }
                    };
                    await messaging!.sendEachForMulticast(payload as any);
                }
            }
        }

        return { success: true, chatId: chatRef.id };

    } catch (error: any) {
        console.error(`Failed to create coaching chat for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

const PostMessageInputSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  userId: z.string(),
  userName: z.string(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
});

export async function postMessageAction(input: z.infer<typeof PostMessageInputSchema>) {
    if (!adminDb || !messaging) {
        console.error("CRITICAL: Firebase Admin is not initialized in postMessageAction.");
        return SERVER_ERROR;
    }
    const { chatId, text, userId, userName, fileUrl, fileName } = PostMessageInputSchema.parse(input);
    const chatDocRef = adminDb.collection('chats').doc(chatId);

    try {
        const chatSnapshot = await chatDocRef.get();
        if (!chatSnapshot.exists) throw new Error("Chat does not exist.");
        const chatData = chatSnapshot.data() as Chat;

        const messageText = text || fileName || 'Attachment';
        const sentTimestamp = new Timestamp(Math.floor(Date.now() / 1000), 0);

        await adminDb.runTransaction(async (transaction) => {
            const messagesCollectionRef = chatDocRef.collection('messages');
            const messageData: any = {
                userId,
                userName,
                timestamp: sentTimestamp,
                isSystemMessage: false,
            };
            if(text) messageData.text = text;
            if(fileUrl) messageData.fileUrl = fileUrl;
            if(fileName) messageData.fileName = fileName;
            transaction.set(messagesCollectionRef.doc(), messageData);

            const updateData: { [key: string]: any } = {
                lastMessage: {
                    text: messageText,
                    timestamp: sentTimestamp,
                    senderId: userId,
                }
            };

            if (!COACH_UIDS.includes(userId)) {
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

        const recipients = chatData.participants.filter(pId => pId !== userId);
        const mutedBy = chatData.mutedBy || [];
        
        for (const recipientId of recipients) {
            if (COACH_UIDS.includes(recipientId) && mutedBy.includes(recipientId)) {
                continue;
            }

            try {
                const userRef = adminDb!.collection("userProfiles").doc(recipientId);
                const userDoc = await userRef.get();

                if (userDoc.exists) {
                    const userData = userDoc.data() as UserProfile;
                    const allTokens = [...(userData.fcmTokens || []), ...(userData.pushToken ? [userData.pushToken] : [])].filter(t => t);

                    if (allTokens.length > 0) {
                        const safeDataPayload = {
                            title: `New message from ${userName}`,
                            body: messageText.slice(0, 100),
                            chatId: String(chatId),
                            notificationType: 'chat',
                            sent_time: String(sentTimestamp.toMillis())
                        };

                        const payload = {
                            tokens: allTokens,
                            data: safeDataPayload,
                            android: {
                                priority: 'high' as const,
                            },
                        };
                        await messaging!.sendEachForMulticast(payload as any);
                    }
                }
            } catch (error) {
                console.error(`Error sending notification to user ${recipientId}:`, error);
            }
        }
        
        return { success: true };

    } catch (error: any) {
        console.error(`Critical error in postMessageAction for chat ${chatId}:`, error);
        return { success: false, error: { message: error.message || `An unknown admin error occurred.` } };
    }
}

export async function joinChat(chatId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in joinChat.");
        return SERVER_ERROR;
    }
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);

        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists) {
                throw new Error("Chat not found.");
            }
            transaction.update(chatRef, { 
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1)
            });
            transaction.update(userProfileRef, { chatIds: FieldValue.arrayUnion(chatId) });
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Error joining chat ${chatId} for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}
  
export async function leaveChat(chatId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in leaveChat.");
        return SERVER_ERROR;
    }
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);

        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            if (!chatDoc.exists) {
                throw new Error("Chat not found.");
            }
            transaction.update(chatRef, { 
                participants: FieldValue.arrayRemove(userId),
                participantCount: FieldValue.increment(-1)
            });
            transaction.update(userProfileRef, { chatIds: FieldValue.arrayRemove(chatId) });
        });

        return { success: true };
    } catch (error: any) {
        console.error(`Error leaving chat ${chatId} for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function getChatMessagesAction(chatId: string): Promise<{ success: boolean; data?: { messages: ChatMessage[], participants: Record<string, UserProfile> }; error?: string }> {
    if (!adminDb) {
        console.error("CRITICAL: Firebase Admin is not initialized in getChatMessagesAction.");
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

        const participants: Record<string, UserProfile> = {};
        if (chatData.participants && chatData.participants.length > 0) {
            const profilePromises = chatData.participants.map(uid => adminDb!.collection('userProfiles').doc(uid).get());
            const profileSnapshots = await Promise.all(profilePromises);
            profileSnapshots.forEach(snap => {
                if (snap.exists) {
                    participants[snap.id] = serializeTimestamps(snap.data()) as UserProfile;
                }
            });
        }

        return { success: true, data: { messages: messages as ChatMessage[], participants } };

    } catch (error: any) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function getUnreadChatCountForCoach(coachId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!adminDb) {
      console.error("CRITICAL: Firebase Admin is not initialized in getUnreadChatCountForCoach.");
      return SERVER_ERROR;
  }
  if (!COACH_UIDS.includes(coachId)) {
      return { success: false, error: "Invalid user." };
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
              
              if (lastMessage.userId && !COACH_UIDS.includes(lastMessage.userId)) {
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
      return { success: false, error: error.message };
  }
}

export async function deleteMessageAction(input: { messageId: string, chatId: string }) {
    console.error("URGENT: deleteMessageAction is not implemented yet.");
    return { success: false, error: "This function is not available at the moment. Please contact support." };
}

export async function createChatAction(input: { name: string, participants: string[], type: 'coaching' | 'group' | 'open' }) {
    console.error("URGENT: createChatAction is not implemented yet.");
    return { success: false, error: "This function is not available at the moment. Please contact support." };
}

export async function toggleChatMuteAction(input: { chatId: string, userId: string }) {
    console.error("URGENT: toggleChatMuteAction is not implemented yet.");
    return { success: false, error: "This function is not available at the moment. Please contact support." };
}

export async function deleteChatAction(input: { chatId: string }) {
    console.error("URGENT: deleteChatAction is not implemented yet.");
    return { success: false, error: "This function is not available at the moment. Please contact support." };
}
