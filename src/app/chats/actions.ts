'use server';

import { db as adminDb, admin, auth } from '@/lib/firebaseAdmin';
import type { Chat, UserProfile, ClientProfile, ChatMessage } from '@/types';
import { z } from 'zod';
import { COACH_UIDS } from '@/lib/coaches';
import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, App, cert, getApp } from 'firebase-admin/app';
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


export async function getChatsAndClientsForCoach(): Promise<{ success: boolean; data?: { chats: Chat[], clients: ClientProfile[] }; error?: any; }> {
    try {
        const chatsQuery = adminDb.collection('chats').orderBy('createdAt', 'desc').get();
        
        const clientsQuery = adminDb.collection('userProfiles').where('tier', 'in', ['premium', 'coaching']).get();

        const [chatsSnapshot, clientsSnapshot] = await Promise.all([chatsQuery, clientsQuery]);
        
        const allChats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        const allClients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));

        const serializableChats = allChats.map(serializeTimestamps);
        const serializableClients = allClients.map(serializeTimestamps);

        return { success: true, data: { chats: serializableChats as Chat[], clients: serializableClients as ClientProfile[] } };

    } catch (error: any) {
        console.error("Error fetching chats and clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}


export async function getChatsForClient(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    try {
        const openChatsQuery = adminDb.collection('chats').where('type', '==', 'open');
        const openChatsPromise = openChatsQuery.get().then(snapshot => 
            snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat))
        );
        
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();
        
        let userChatIds: string[] = [];
        if (userProfileSnap.exists) {
            const userProfileData = userProfileSnap.data() as UserProfile;
            userChatIds = userProfileData.chatIds || [];
        }

        let userChats: Chat[] = [];
        if (userChatIds.length > 0) {
            const MAX_IDS_PER_QUERY = 30; 
            for (let i = 0; i < userChatIds.length; i += MAX_IDS_PER_QUERY) {
                const chunk = userChatIds.slice(i, i + MAX_IDS_PER_QUERY);
                if(chunk.length > 0) {
                    const q = adminDb.collection('chats').where(FieldPath.documentId(), 'in', chunk);
                    const snapshot = await q.get();
                    snapshot.forEach(docSnap => {
                        userChats.push({ id: docSnap.id, ...docSnap.data() } as Chat);
                    });
                }
            }
        }
        
        const [openChats] = await Promise.all([openChatsPromise]);
        const combinedChats = [...userChats, ...openChats];
        const uniqueChats = Array.from(new Map(combinedChats.map(chat => [chat.id, chat])).values());

        const serializableData = uniqueChats.map(serializeTimestamps);
        
        serializableData.sort((a: any, b: any) => {
            const dateA = new Date(a.lastClientMessage || a.lastMessage || a.createdAt || "0").getTime();
            const dateB = new Date(b.lastClientMessage || b.lastMessage || b.createdAt || "0").getTime();
            return dateB - dateA;
        });
        
        return { success: true, data: serializableData as Chat[] };
    } catch (error: any) {
        console.error("Error fetching user's chats (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}


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
      const STORAGE_ADMIN_APP_NAME = 'storage-admin-app-instance';
  
      const getStorageAdminApp = (): App => {
          if (getApps().some(app => app.name === STORAGE_ADMIN_APP_NAME)) {
              return getApp(STORAGE_ADMIN_APP_NAME);
          }
  
          const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
          if (!serviceAccountKey) {
              throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY is not set for signed URL generation.');
          }
          const serviceAccount = JSON.parse(serviceAccountKey);
  
          return initializeApp({
              credential: cert(serviceAccount),
              storageBucket: 'hunger-free-and-happy-app.firebasestorage.app',
          }, STORAGE_ADMIN_APP_NAME);
      };
  
      const storageAdminApp = getStorageAdminApp();
      const authenticatedStorage = getStorage(storageAdminApp);
      
      const bucket = authenticatedStorage.bucket();
      const uniqueFileName = `${path}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
      const file = bucket.file(uniqueFileName);
  
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });

  
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;
  
      return { success: true, signedUrl, publicUrl };
  
    } catch (error: any) {
      console.error("Error generating signed URL with surgical fix: ", error);
      return { success: false, error: error.message || 'Failed to generate signed URL.' };
    }
  }
  

const PostMessageInputSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  userId: z.string(),
  userName: z.string(),
  isCoach: z.boolean(),
  isAutomated: z.boolean().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
});

// --- GENIE'S SINGLE-LINE FIX ---
// The function was writing to the wrong collection ('user_scheduled_reminders').
// This change corrects the collection name to 'notifications', matching the unified engine.
export async function postMessageAction(input: z.infer<typeof PostMessageInputSchema>) {
    
    const { chatId, text, userId, userName, isCoach, isAutomated, fileUrl, fileName } = PostMessageInputSchema.parse(input);

    const chatDocRef = adminDb.collection('chats').doc(chatId);
    
    try {
        const chatSnapshot = await chatDocRef.get();
        if (!chatSnapshot.exists) {
            throw new Error("Chat does not exist.");
        }
        const chatData = chatSnapshot.data() as Chat;

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
              lastMessage: FieldValue.serverTimestamp(),
              lastMessageSenderId: userId,
            };
            
            if (chatData.type === 'coaching') {
                const senderIsCoach = COACH_UIDS.includes(userId);
                if (isAutomated) {
                    updateData.lastAutomatedMessage = FieldValue.serverTimestamp();
                } else if (senderIsCoach) {
                    updateData.lastCoachMessage = FieldValue.serverTimestamp();
                } else {
                    updateData.lastClientMessage = FieldValue.serverTimestamp();
                }
            }

            transaction.update(chatDocRef, updateData);
        });

        const recipients = chatData.participants.filter(pId => pId !== userId);
        const notificationPromises: Promise<any>[] = [];

        for (const recipientId of recipients) {
            const isRecipientCoach = COACH_UIDS.includes(recipientId);
            const ctaUrl = isRecipientCoach ? `/coach/chats/${chatId}` : `/client/dashboard?chatId=${chatId}`;

            // THE FIX: Changed collection name to the correct 'notifications' collection.
            const newNotificationRef = adminDb.collection('notifications').doc();
            const notificationPromise = newNotificationRef.set({
                userId: recipientId,
                status: 'scheduled',
                type: 'chat_message',
                title: `New message from ${userName}`,
                message: text || (fileName ? `Sent an attachment: ${fileName}` : 'Sent a message'),
                chatName: chatData.name || 'Group Chat',
                scheduledAt: Timestamp.now(), 
                isRecurring: false,
                ctaText: 'View Chat',
                ctaType: 'openUrl',
                ctaUrl: ctaUrl,
            });
            notificationPromises.push(notificationPromise);
        }

        if (notificationPromises.length > 0) {
            await Promise.all(notificationPromises);
        }
        
        return { success: true };

    } catch (error: any) {
        console.error(`Critical error in postMessageAction for chat ${chatId}:`, error);
        return { success: false, error: { message: error.message || `An unknown admin error occurred while posting message.` } };
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

export async function getCoachingChatIdForClient(clientId: string): Promise<{ success: boolean; chatId?: string; error?: string }> {
    try {
        const chatsQuery = adminDb.collection('chats')
            .where('type', '==', 'coaching')
            .where('participants', 'array-contains', clientId)
            .limit(1);

        const chatsSnapshot = await chatsQuery.get();

        if (chatsSnapshot.empty) {
            return { success: false, error: 'No coaching chat found for this client.' };
        }

        const chatId = chatsSnapshot.docs[0].id;
        return { success: true, chatId };

    } catch (error: any) {
        console.error(`Error finding coaching chat for client ${clientId}:`, error);
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}

export async function createCoachingChatOnFirstLogin(user: ClientProfile): Promise<{ success: boolean; error?: string; }> {
    if (user.tier !== 'coaching' || user.hasLoggedInBefore === true) {
        return { success: true };
    }

    const batch = adminDb.batch();
    const userRef = adminDb.collection('userProfiles').doc(user.uid);
    const chatRef = adminDb.collection('chats').doc();

    try {
        const alanUID = 'yue7fVPBQZg45vmfXXUH5PdG7jE2'; 
        const crystalUID = 'oYsf7Iah6hVlEgHvWJ7Ms7j1oTB2';
        const participants = [user.uid, alanUID, crystalUID];

        batch.set(chatRef, {
            name: `${user.fullName} Coaching`,
            type: 'coaching',
            participants: participants,
            participantCount: participants.length,
            ownerId: alanUID,
            createdAt: FieldValue.serverTimestamp(),
        });

        const welcomeMessageRef = chatRef.collection('messages').doc();
        const userFirstName = user.fullName.split(' ')[0];
        const welcomeText = `Hi ${userFirstName} and welcome to coaching. This is your private coaching chat with just the two of us and yourself. We are excited to work with you. Can you tell us a bit about yourself, what brings you to coaching, and what you hope to accomplish through it? To make your video conference appointment you can go to the "Book a Call" button and choose either of us to book a call with and the available times each day.`;

        batch.set(welcomeMessageRef, {
            userId: alanUID,
            userName: 'Alan Roberts',
            timestamp: FieldValue.serverTimestamp(),
            text: welcomeText,
            isSystemMessage: false,
        });

        batch.update(chatRef, {
            lastMessage: welcomeText,
            lastMessageSenderId: alanUID,
            lastCoachMessage: FieldValue.serverTimestamp(),
        });
        
        batch.update(userRef, {
            hasLoggedInBefore: true,
            chatIds: FieldValue.arrayUnion(chatRef.id)
        });

        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error('Error in createCoachingChatOnFirstLogin:', error);
        return { success: false, error: error.message };
    }
}
