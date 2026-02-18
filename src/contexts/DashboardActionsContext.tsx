'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Chat } from '@/services/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsForClient, getChatMetadataForUser } from '@/app/chats/actions';

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

interface DashboardState {
  chats: Chat[];
  unreadChatCount: number;
  chatMetadata: Record<string, { lastReadTimestamp: any }>;
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

  // ** START: UNREAD COUNT SYNCHRONIZATION **
  // The unreadCount is now calculated as a simple sum of the `unreadCount` field provided by the backend.
  const unreadChatCount = useMemo(() => {
    if (!chats) return 0;
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  }, [chats]);
  // ** END: UNREAD COUNT SYNCHRONIZATION **

  const stateValue = useMemo(() => ({
    chats,
    unreadChatCount,
    chatMetadata,
    fetchChats
  }), [chats, unreadChatCount, chatMetadata, fetchChats]);

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
