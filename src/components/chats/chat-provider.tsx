'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  Suspense,
  useCallback,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { EmbeddedChatDialog } from '@/components/chats/embedded-chat-dialog';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '../auth/auth-provider';
import { useNotificationStore } from '@/store/notification-store';

interface ChatContextType {
  openChat: (chatId: string, chatName?: string) => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChats() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChats must be used within a ChatProvider');
  }
  return context;
}

// This component isolates the useSearchParams hook and is wrapped in Suspense
function ChatUrlController() {
  const { openChat } = useChats();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const chatToOpen = searchParams.get('openChat') || searchParams.get('openChatId');
    
    if (chatToOpen) {
      openChat(chatToOpen);
      
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('openChat');
      newParams.delete('openChatId');
      newParams.delete('notificationType');
      
      const queryString = newParams.toString();
      const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
      
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, openChat, router]);

  return null;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string>('Chat');
  const { notificationChatId, setNotificationChatId } = useNotificationStore();

  // MOVED UP: Define openChat and closeChat functions before they are used.
  const openChat = useCallback((chatId: string, name?: string) => {
    setActiveChatId(chatId);
    if (name) {
      setChatName(name);
    }
  }, []);

  const closeChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  // This useEffect now correctly uses the pre-defined openChat function.
  // It watches the notification store and clears the state after opening a chat.
  useEffect(() => {
    if (notificationChatId) {
      openChat(notificationChatId);
      setNotificationChatId(null);
    }
  }, [notificationChatId, openChat, setNotificationChatId]);

  // Fetch chat details when a chat is opened
  useEffect(() => {
    if (!activeChatId || !user) {
      return;
    }

    const fetchChatName = async () => {
      try {
        const chatRef = doc(db, 'chats', activeChatId);
        const chatSnap = await getDoc(chatRef);

        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          if (chatData.name) {
            setChatName(chatData.name);
            return;
          }
          const otherParticipantId = chatData.participants.find(
            (p: string) => p !== user.uid
          );
          if (otherParticipantId) {
            const userRef = doc(db, 'clients', otherParticipantId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              setChatName(userSnap.data().fullName || 'Chat');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching chat name:', error);
        setChatName('Chat');
      }
    };

    fetchChatName();
  }, [activeChatId, user]);

  const value = { openChat, closeChat };

  return (
    <ChatContext.Provider value={value}>
      <Suspense fallback={null}>
        <ChatUrlController />
      </Suspense>
      {children}
      {activeChatId && (
        <EmbeddedChatDialog
          chatId={activeChatId}
          chatName={chatName}
          isOpen={!!activeChatId}
          onClose={closeChat}
        />
      )}
    </ChatContext.Provider>
  );
}
