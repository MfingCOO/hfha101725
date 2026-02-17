'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Chat } from '@/services/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsForClient, getChatMetadataForUser } from '@/app/chats/actions';

// ** START: UNIFIED CHAT DIALOG CONTEXT **
interface ChatDialogContextType {
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
}

const ChatDialogContext = createContext<ChatDialogContextType | undefined>(undefined);

export const ChatDialogProvider = ({ children }: { children: React.ReactNode }) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const openChat = () => setIsChatOpen(true);
    const closeChat = () => setIsChatOpen(false);

    const value = useMemo(() => ({ isChatOpen, openChat, closeChat }), [isChatOpen]);

    return (
        <ChatDialogContext.Provider value={value}>
            {children}
        </ChatDialogContext.Provider>
    );
};

export const useChatDialog = () => {
    const context = useContext(ChatDialogContext);
    if (context === undefined) {
        throw new Error('useChatDialog must be used within a ChatDialogProvider');
    }
    return context;
};
// ** END: UNIFIED CHAT DIALOG CONTEXT **


/**
 * Safely converts various timestamp formats to milliseconds since epoch.
 */
function getMillis(timestamp: any): number {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.getTime === 'function') return timestamp.getTime();
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    if (typeof timestamp === 'number') return timestamp;
    return 0;
}

interface DashboardState {
  chats: Chat[];
  hasUnreadChats: boolean;
  fetchChats: () => void;
}

interface DashboardActions {
  onOpenChallenges: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  isChallengesOpen: boolean;
  isCalendarOpen: boolean;
  isSettingsOpen: boolean;
  onCloseChallenges: () => void;
  onCloseCalendar: () => void;
  onCloseSettings: () => void;
}

const DashboardStateContext = createContext<DashboardState | undefined>(undefined);
const DashboardActionsContext = createContext<DashboardActions | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatMetadata, setChatMetadata] = useState<Record<string, { lastReadTimestamp: any }>>({});

  const [isChallengesOpen, setIsChallengesOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchChatMetadata = useCallback(async () => {
    if (!user) return;
    const result = await getChatMetadataForUser(user.uid);
    if (result.success && result.data) {
        setChatMetadata(result.data);
    }
  }, [user]);

  const fetchChats = useCallback(async () => {
    if (!user) return;
    const result = await getChatsForClient(user.uid);
    if (result.success && result.data) {
      setChats(result.data);
    }
    await fetchChatMetadata();
  }, [user, fetchChatMetadata]);

  useEffect(() => {
    if (!user) return;
    fetchChats();
  }, [user, fetchChats]);

  const hasUnreadChats = useMemo(() => {
    if (!user || !chats) return false;

    return chats.some(chat => {
        const lastMessage = chat.lastMessage as any;
        if (!lastMessage || !lastMessage.senderId || !lastMessage.timestamp) return false;
        if (lastMessage.senderId === user.uid) return false;

        const lastReadTimestamp = chatMetadata[chat.id]?.lastReadTimestamp;
        const lastMessageMillis = getMillis(lastMessage.timestamp);

        if (!lastReadTimestamp) return lastMessageMillis > 0;
        
        const lastReadMillis = getMillis(lastReadTimestamp);
        return lastMessageMillis > lastReadMillis;
    });
  }, [chats, user, chatMetadata]);

  const stateValue = useMemo(() => ({
    chats,
    hasUnreadChats,
    fetchChats
  }), [chats, hasUnreadChats, fetchChats]);

  const actionsValue = useMemo(() => ({
    onOpenChallenges: () => setIsChallengesOpen(true),
    onOpenCalendar: () => setIsCalendarOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
    isChallengesOpen,
    isCalendarOpen,
    isSettingsOpen,
    onCloseChallenges: () => setIsChallengesOpen(false),
    onCloseCalendar: () => setIsCalendarOpen(false),
    onCloseSettings: () => setIsSettingsOpen(false),
  }), [isChallengesOpen, isCalendarOpen, isSettingsOpen]);

  return (
    <DashboardStateContext.Provider value={stateValue}>
      <DashboardActionsContext.Provider value={actionsValue}>
        {children}
      </DashboardActionsContext.Provider>
    </DashboardStateContext.Provider>
  );
}

export function useDashboardState() {
  const context = useContext(DashboardStateContext);
  if (context === undefined) {
    throw new Error('useDashboardState must be used within a DashboardProvider');
  }
  return context;
}

export function useDashboardActions() {
  const context = useContext(DashboardActionsContext);
  if (context === undefined) {
    throw new Error('useDashboardActions must be used within a DashboardProvider');
  }
  return context;
}
