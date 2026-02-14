'use server';

import { db as adminDb, admin, messaging } from '@/lib/firebaseAdmin';
import type { Chat, UserProfile, ClientProfile, ChatMessage } from '@/types';
import { z } from 'zod';
import { COACH_UIDS } from '@/lib/coaches';
import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Helper for serialization
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

// Action to get all chats and relevant clients for the coach dashboard
export async function getChatsAndClientsForCoach(): Promise<{ success: boolean; data?: { chats: Chat[], clients: ClientProfile[] }; error?: any; }> {
    try {
        const chatsQuery = adminDb.collection('chats').orderBy('createdAt', 'desc').get();
        const clientsQuery = adminDb.collection('userProfiles').where('tier', 'in', ['premium', 'coaching']).get();
        const [chatsSnapshot, clientsSnapshot] = await Promise.all([chatsQuery, clientsQuery]);
        
        let allChats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        const allClients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));

// ** START OF CRASH FIX AND DATA ENHANCEMENT **
const chatsWithDataPromises = allChats.map(async (chat) => {
    const recentMessagesQuery = adminDb.collection('chats').doc(chat.id).collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(20);

    try {
        const snapshot = await recentMessagesQuery.get();
        
        // If there are no messages, there's nothing to process. Return a safe version of the chat.
        if (snapshot.empty) {
            return {
                ...chat,
                lastMessage: null, // Explicitly set to null
                lastClientMessageTimestamp: null, // Explicitly set to null
            };
        }

        const recentMessages = snapshot.docs.map(doc => doc.data());

        // Safely get the absolute last message (for red dot notifications)
        const lastMessageData = recentMessages[0];
        const lastMessage = {
            text: lastMessageData.text || (lastMessageData.fileName ? 'Attachment' : '[System Message]'),
            timestamp: lastMessageData.timestamp || new Timestamp(0, 0), // Fallback to epoch time
            senderId: lastMessageData.userId || 'system'
        };

        // Safely get the last client message timestamp (for Active/MIA bucketing)
        const lastClientMessageData = recentMessages.find(msg => msg.userId && !COACH_UIDS.includes(msg.userId));
        const lastClientMessageTimestamp = lastClientMessageData ? (lastClientMessageData.timestamp || null) : null;

        // Return the chat with guaranteed fresh and safe data.
        return {
            ...chat,
            lastMessage,
            lastClientMessageTimestamp
        };

    } catch (error) {
        console.error(`Error enhancing chat data for chat ${chat.id}:`, error);
        // On error, return a safe, non-crashing version of the chat object.
        return {
            ...chat,
            lastMessage: null,
            lastClientMessageTimestamp: null,
        };
    }
});

allChats = await Promise.all(chatsWithDataPromises);
// ** END OF CRASH FIX AND DATA ENHANCEMENT **


        const serializableChats = allChats.map(serializeTimestamps);
        const serializableClients = allClients.map(serializeTimestamps);

        return { success: true, data: { chats: serializableChats as Chat[], clients: serializableClients as ClientProfile[] } };
    } catch (error: any) {
        console.error("Error fetching chats and clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

// Action to get chats for a specific client
export async function getChatsForClient(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    try {
        const userProfileSnap = await adminDb.collection('userProfiles').doc(userId).get();
        if (!userProfileSnap.exists) {
            // If user profile doesn't exist, they have no chats.
            return { success: true, data: [] };
        }
        
        const userProfile = userProfileSnap.data() as UserProfile;
        const userChatIds = userProfile.chatIds || [];
        const userTier = userProfile.tier;

        const chatPromises: Promise<any>[] = [];

        // 1. Fetch chats the user is directly a member of.
        if (userChatIds.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < userChatIds.length; i += 30) {
                chunks.push(userChatIds.slice(i, i + 30));
            }
            chunks.forEach(chunk => {
                chatPromises.push(adminDb.collection('chats').where(FieldPath.documentId(), 'in', chunk).get());
            });
        }

        // ** START TIER-BASED CHAT FIX **
        // 2. Only fetch 'open' chats if the user is on a premium tier.
        if (userTier === 'premium' || userTier === 'coaching') {
            chatPromises.push(adminDb.collection('chats').where('type', '==', 'open').get());
        }
        // ** END TIER-BASED CHAT FIX **

        const snapshots = await Promise.all(chatPromises);

        const allChats: Chat[] = [];
        snapshots.forEach(snapshot => {
            snapshot.forEach((docSnap: any) => {
                allChats.push({ id: docSnap.id, ...docSnap.data() } as Chat);
            });
        });
        
        // Remove duplicates (in case a user is in an open chat already)
        const uniqueChats = Array.from(new Map(allChats.map(chat => [chat.id, chat])).values());

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



// Action to get all of a user's chat metadata (like last read times)
export async function getChatMetadataForUser(userId: string): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
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

export async function createCoachingChatOnFirstLogin(userId: string, userName: string): Promise<{ success: boolean; chatId?: string; error?: string }> {
    try {
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
            throw new Error('User profile not found.');
        }

        const userProfile = userProfileSnap.data() as UserProfile;
        
        if (userProfile.hasHadCoachingChat) {
            console.log(`User ${userId} has already had a coaching chat. Skipping creation.`);
            return { success: true };
        }
        
        const primaryCoachId = COACH_UIDS[0];
        if (!primaryCoachId) {
            throw new Error("No coaches are configured in the system.");
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

        const initialMessage = {
            userId: 'system',
            userName: 'System',
            text: `This private coaching chat has been created for ${userName}.`,
            timestamp: FieldValue.serverTimestamp(),
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

        console.log(`Successfully created coaching chat ${chatRef.id} for user ${userId}`);
        return { success: true, chatId: chatRef.id };

    } catch (error: any) {
        console.error(`Failed to create coaching chat for user ${userId}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred while creating the coaching chat.' };
    }
}


// Action to post a new message to a chat
const PostMessageInputSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  userId: z.string(),
  userName: z.string(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
});

export async function postMessageAction(input: z.infer<typeof PostMessageInputSchema>) {
    const { chatId, text, userId, userName, fileUrl, fileName } = PostMessageInputSchema.parse(input);
    const chatDocRef = adminDb.collection('chats').doc(chatId);

    try {
        const chatSnapshot = await chatDocRef.get();
        if (!chatSnapshot.exists) throw new Error("Chat does not exist.");
        const chatData = chatSnapshot.data() as Chat;

        const messageText = text || fileName || 'Attachment';

        // ** START ROBUST DOT FIX **
        // This transaction now includes marking the chat as read for the sender.
        await adminDb.runTransaction(async (transaction) => {
            const messagesCollectionRef = chatDocRef.collection('messages');
            const messageData: any = {
                userId,
                userName,
                timestamp: FieldValue.serverTimestamp(),
                isSystemMessage: false,
            };
            if(text) messageData.text = text;
            if(fileUrl) messageData.fileUrl = fileUrl;
            if(fileName) messageData.fileName = fileName;
            transaction.set(messagesCollectionRef.doc(), messageData);

            const updateData: { [key: string]: any } = {
                lastMessage: {
                    text: messageText,
                    timestamp: FieldValue.serverTimestamp(),
                    senderId: userId,
                }
            };

            if (!COACH_UIDS.includes(userId)) {
                updateData.lastClientMessageTimestamp = FieldValue.serverTimestamp();
            }
            
            // Mark chat as read for the SENDER within the same transaction
            const senderMetadataRef = adminDb.collection('user_chat_metadata').doc(`${userId}_${chatId}`);
            transaction.set(senderMetadataRef, {
                userId: userId,
                chatId: chatId,
                lastReadTimestamp: FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.update(chatDocRef, updateData);
        });
        // ** END ROBUST DOT FIX **

        const recipients = chatData.participants.filter(pId => pId !== userId);
        const mutedBy = chatData.mutedBy || [];
        
        const notificationPromises = recipients.map(async (recipientId) => {
            if (COACH_UIDS.includes(recipientId) && mutedBy.includes(recipientId)) {
                return;
            }

            const notificationPayload = {
                title: `New message in ${chatData.name || 'chat'}`,
                body: `${userName}: ${messageText}`.slice(0, 100),
            };

            try {
                const userRef = adminDb.collection("userProfiles").doc(recipientId);
                const userDoc = await userRef.get();

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData && userData.fcmTokens && userData.fcmTokens.length > 0) {
                        const validTokens = userData.fcmTokens.filter((t: any) => t);
                        
                        if (validTokens.length > 0) {
                            const message = {
                                tokens: validTokens,
                                notification: {
                                    // We are encoding the chatId in the title
                                    title: `[CHAT:${chatId}] ${notificationPayload.title}`,
                                    body: notificationPayload.body
                                },
                                // The 'data' payload is removed entirely for Android
                                android: {
                                    priority: "high" as const,
                                    notification: {
                                        channelId: "default_notification_channel"
                                    }
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            alert: {
                                                title: notificationPayload.title,
                                                body: notificationPayload.body
                                            },
                                            badge: 1,
                                            sound: "default"
                                        },
                                        // We still send data to iOS
                                        userInfo: {
                                            chatId: String(chatId)
                                        }
                                    }
                                }
                            };
                            await messaging.sendEachForMulticast(message);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error sending push notification to user ${recipientId}:`, error);
            }
        });

        await Promise.all(notificationPromises);
        
        return { success: true };

    } catch (error: any) {
        console.error(`Critical error in postMessageAction for chat ${chatId}:`, error);
        return { success: false, error: { message: error.message || `An unknown admin error occurred.` } };
    }
}


// New action to toggle mute status for a coach
const ToggleChatMuteInputSchema = z.object({
    chatId: z.string(),
    coachId: z.string(),
  });
  
export async function toggleChatMuteAction(input: z.infer<typeof ToggleChatMuteInputSchema>) {
    const { chatId, coachId } = ToggleChatMuteInputSchema.parse(input);

    if (!COACH_UIDS.includes(coachId)) {
        return { success: false, error: "Only coaches can mute chats." };
    }

    const chatRef = adminDb.collection('chats').doc(chatId);

    try {
        const chatDoc = await chatRef.get();
        if (!chatDoc.exists) {
            return { success: false, error: "Chat not found." };
        }

        const chatData = chatDoc.data() as Chat;
        const mutedBy = chatData.mutedBy || [];

        if (mutedBy.includes(coachId)) {
            await chatRef.update({ mutedBy: FieldValue.arrayRemove(coachId) });
        } else {
            await chatRef.update({ mutedBy: FieldValue.arrayUnion(coachId) });
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to toggle mute for chat ${chatId}:`, error);
        return { success: false, error: error.message };
    }
}

// New action to mark a chat as read by a user
const MarkChatAsReadInputSchema = z.object({
    chatId: z.string(),
    userId: z.string(),
});

export async function markChatAsReadAction(input: z.infer<typeof MarkChatAsReadInputSchema>) {
    const { chatId, userId } = MarkChatAsReadInputSchema.parse(input);
    const metadataRef = adminDb.collection('user_chat_metadata').doc(`${userId}_${chatId}`);

    try {
        await metadataRef.set({
            userId: userId, // Store the userId in the document as well for querying
            chatId: chatId,
            lastReadTimestamp: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Failed to mark chat ${chatId} as read for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}


// OTHER ACTIONS (UNCHANGED for this step, but included for completeness)

export async function getChatDetailsForCoach(chatId: string): Promise<{ success: boolean; data?: Chat; error?: any; }> {
    try {
        const docRef = adminDb.collection('chats').doc(chatId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = { id: docSnap.id, ...docSnap.data() };
            const serializableData = serializeTimestamps(data);
            return { success: true, data: serializableData as Chat };
        }
        return { success: false, error: 'Chat not found' };
    } catch (error: any) {
        console.error('Error getting chat details (admin):', error);
        return { success: false, error: { message: error.message || 'An unknown admin error occurred' } };
    }
}

export async function getChatMessagesAction(chatId: string): Promise<{ success: boolean; data?: { messages: ChatMessage[], participants: Record<string, UserProfile> }; error?: string }> {
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
            const profilePromises = chatData.participants.map(uid => adminDb.collection('userProfiles').doc(uid).get());
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

export async function getSignedUrlAction(fileName: string, path: string, contentType: string): Promise<{ success: boolean, signedUrl?: string, publicUrl?: string, error?: string }> {
    try {
      const bucket = getStorage().bucket('hunger-free-and-happy-app.firebasestorage.app');
      const uniqueFileName = `${path}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
      const file = bucket.file(uniqueFileName);
  
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType,
      });
  
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
  
      return { success: true, signedUrl, publicUrl };
  
    } catch (error: any) {
      console.error("Error generating signed URL: ", error);
      return { success: false, error: error.message || 'Failed to generate signed URL.' };
    }
}

const DeleteMessageInputSchema = z.object({
    chatId: z.string(),
    messageId: z.string(),
    requesterId: z.string(),
  });
  
  export async function deleteMessageAction(input: z.infer<typeof DeleteMessageInputSchema>) {
      const { chatId, messageId, requesterId } = DeleteMessageInputSchema.parse(input);
  
      const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc(messageId);
  
      try {
          const messageDoc = await messageRef.get();
          if (!messageDoc.exists) {
              throw new Error("Message not found.");
          }
  
          const messageData = messageDoc.data();
          const authorId = messageData?.userId;
          
          const isCoach = COACH_UIDS.includes(requesterId);
          const isAuthor = requesterId === authorId;
  
          if (!isCoach && !isAuthor) {
              throw new Error("You don't have permission to delete this message.");
          }
          
          await messageRef.delete();
  
          return { success: true };
  
      } catch (error: any) {
          console.error(`Error deleting message ${messageId} from chat ${chatId}:`, error);
          return { success: false, error: { message: error.message || "Could not delete message." } };
      }
  }
  
  export async function deleteChatAction(chatId: string, requesterId: string) {
      if (!COACH_UIDS.includes(requesterId)) {
          return { success: false, error: "You don't have permission to perform this action." };
      }
      
      const chatRef = adminDb.collection('chats').doc(chatId);
  
      try {
          const chatDoc = await chatRef.get();
          if (!chatDoc.exists) {
              throw new Error("Chat not found.");
          }
          const chatData = chatDoc.data() as Chat;
  
          const batch = adminDb.batch();
  
          if (chatData.participants && chatData.participants.length > 0) {
              for (const uid of chatData.participants) {
                  const userProfileRef = adminDb.collection('userProfiles').doc(uid);
                  batch.update(userProfileRef, { chatIds: FieldValue.arrayRemove(chatId) });
              }
          }
          
          batch.delete(chatRef);

          await batch.commit();
          return { success: true };

      } catch(error: any) {
          console.error("Error deleting chat:", error);
          return { success: false, error: error.message };
      }
  }
      
  const CreateChatInputSchema = z.object({
    name: z.string().min(3),
    description: z.string().min(10),
    type: z.enum(['open', 'private_group']),
    rules: z.string().optional(),
    participantIds: z.array(z.string()).optional(),
    requesterId: z.string(),
  });
  
  export async function createChatAction(input: z.infer<typeof CreateChatInputSchema>) {
      const { name, description, type, rules, participantIds = [], requesterId } = CreateChatInputSchema.parse(input);
  
      if (!COACH_UIDS.includes(requesterId)) {
          return { success: false, error: "Only coaches can create chats." };
      }
  
      const ownerId = requesterId;
  
      try {
          const batch = adminDb.batch();
          const chatRef = adminDb.collection('chats').doc();
          
          const participants = Array.from(new Set([ownerId, ...participantIds]));
  
          const chatData: Omit<Chat, 'id'> = {
              name,
              description,
              type,
              participants,
              participantCount: participants.length,
              ownerId,
              createdAt: FieldValue.serverTimestamp() as any,
              rules: rules?.split('\n') || [],
          };
          
          batch.set(chatRef, chatData);
          
          const initialMessage = {
              userId: 'system',
              userName: 'System',
              text: `Chat "${name}" created by a coach.`,
              timestamp: FieldValue.serverTimestamp(),
              isSystemMessage: true,
          };
          const messageRef = chatRef.collection('messages').doc();
          batch.set(messageRef, initialMessage);

          for (const uid of participants) {
              const userProfileRef = adminDb.collection('userProfiles').doc(uid);
              batch.update(userProfileRef, { chatIds: FieldValue.arrayUnion(chatRef.id) });
          }

          await batch.commit();
          return { success: true, chatId: chatRef.id };

      } catch (error: any) {
          console.error("Error in createChatAction:", error);
          return { success: false, error: error.message };
      }
  }
  
  export async function joinChat(chatId: string, userId: string): Promise<{ success: boolean; error?: string }> {
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
  export async function getUnreadChatCountForCoach(coachId: string): Promise<{ success: boolean; count?: number; error?: string }> {
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
                // The chatId is the doc.id without the user's ID prefix
                const chatId = doc.id.replace(`${coachId}_`, '');
                lastReadTimestamps[chatId] = data.lastReadTimestamp.toDate();
            }
        });

        let unreadCount = 0;
        const chatProcessingPromises = chatsSnapshot.docs.map(async (chatDoc) => {
            const chat = { id: chatDoc.id, ...chatDoc.data() } as Chat;

            if (chat.type !== 'coaching' || (chat.mutedBy && chat.mutedBy.includes(coachId))) {
                return; // Skip non-coaching or muted chats
            }

            const messagesQuery = adminDb.collection('chats').doc(chat.id).collection('messages').orderBy('timestamp', 'desc').limit(1).get();
            const lastMessageSnapshot = await messagesQuery;

            if (!lastMessageSnapshot.empty) {
                const lastMessage = lastMessageSnapshot.docs[0].data();
                
                // If the last message is from a client
                if (lastMessage.userId && !COACH_UIDS.includes(lastMessage.userId)) {
                    const lastReadTime = lastReadTimestamps[chat.id];
                    const lastMessageTime = lastMessage.timestamp.toDate();

                    // If there is no read receipt or the message is newer than the receipt
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
