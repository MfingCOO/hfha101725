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
    const chatToOpen = searchParams.get('openChat');
    if (chatToOpen) {
      openChat(chatToOpen);
      // Clean the URL by removing the 'openChat' search param
      const newPath = window.location.pathname;
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('openChat');
      router.replace(`${newPath}?${newParams.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null; // This component does not render anything
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string>('Chat');

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
          // For group chats, use the chat name
          if (chatData.name) {
            setChatName(chatData.name);
            return;
          }
          // For 1-on-1 chats, find the other participant's name
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

  const openChat = useCallback((chatId: string, name?: string) => {
    setActiveChatId(chatId);
    if (name) {
      setChatName(name);
    }
    // If name isn't provided, the useEffect will fetch it.
  }, []);

  const closeChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

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
