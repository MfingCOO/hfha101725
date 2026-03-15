'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Chat } from '@/types';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsForClient, getChatMetadataForUser } from '@/app/chats/actions';

// --- ChatDialog Context ---
interface ChatDialogContextType {
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  isCoachChatOpen: boolean;
  openCoachChat: () => void;
  closeCoachChat: () => void;
  selectedChatId: string | null;
  setSelectedChatId: (chatId: string | null) => void;
}

const ChatDialogContext = createContext<ChatDialogContextType | undefined>(undefined);

export const ChatDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCoachChatOpen, setIsCoachChatOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => {
    setIsChatOpen(false);
    setSelectedChatId(null);
  };

  const openCoachChat = () => setIsCoachChatOpen(true);
  const closeCoachChat = () => {
    setIsCoachChatOpen(false);
    setSelectedChatId(null);
  };

  const value = useMemo(() => ({
    isChatOpen,
    openChat,
    closeChat,
    isCoachChatOpen,
    openCoachChat,
    closeCoachChat,
    selectedChatId,
    setSelectedChatId
  }), [isChatOpen, isCoachChatOpen, selectedChatId]);

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

// --- Dashboard Context ---
interface DashboardState {
  chats: Chat[];
  unreadChatCount: number;
  chatMetadata: Record<string, { lastReadTimestamp: any }>;
  fetchChats: (isManual?: boolean) => Promise<void>;
  isNotificationsOpen: boolean;
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
  setIsNotificationsOpen: (isOpen: boolean) => void;
  onCloseNotifications: () => void;
}

const DashboardStateContext = createContext<DashboardState | undefined>(undefined);
const DashboardActionsContext = createContext<DashboardActions | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // These refs act as the gatekeeper to prevent infinite loops
  const lastFetchedUid = useRef<string | null>(null);
  const isFetching = useRef(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [chatMetadata, setChatMetadata] = useState<Record<string, { lastReadTimestamp: any }>>({});
  const [isChallengesOpen, setIsChallengesOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  /**
   * Main data fetcher. 
   * @param isManual If true, bypasses the UID check (used for notifications/refresh)
   */
  const fetchChats = useCallback(async (isManual = false) => {
    const currentUid = user?.uid;
    if (!currentUid) return;

    // Logic Gate: Stop if we already have data for this user AND it's not a manual refresh
    if (!isManual && lastFetchedUid.current === currentUid) return;
    
    // Concurrency Gate: Stop if a fetch is already in flight
    if (isFetching.current) return;

    isFetching.current = true;
    try {
      console.log(isManual ? "🔄 Dashboard Refreshing (Manual/Notification)" : "🚀 Dashboard Initial Load");
      
      const [chatsResult, metadataResult] = await Promise.all([
        getChatsForClient(currentUid),
        getChatMetadataForUser(currentUid)
      ]);

      if (chatsResult.success && chatsResult.data) {
        setChats(chatsResult.data);
      }
      if (metadataResult.success && metadataResult.data) {
        setChatMetadata(metadataResult.data);
      }

      // Mark this UID as successfully loaded
      lastFetchedUid.current = currentUid;
    } catch (error) {
      console.error("DashboardProvider: Failed to fetch data", error);
    } finally {
      isFetching.current = false;
    }
  }, [user?.uid]);

  // Handle automatic load when user logs in
  useEffect(() => {
    if (user?.uid) {
      fetchChats(false); // Runs the gated fetch
    } else {
      // Clear tracking if user logs out
      lastFetchedUid.current = null;
    }
  }, [user?.uid, fetchChats]);

  // Derived unread count logic
  const unreadChatCount = useMemo(() => {
    if (!chats || !chatMetadata || !user?.uid) return 0;

    return chats.reduce((count, chat) => {
      const metadata = chatMetadata[chat.id];
      const lastRead = metadata?.lastReadTimestamp 
        ? new Date(metadata.lastReadTimestamp.seconds * 1000) 
        : new Date(0);
      
      const lastMessageTimestamp = chat.lastMessage?.timestamp 
        ? new Date(chat.lastMessage.timestamp) 
        : new Date(0);

      if (lastMessageTimestamp > lastRead && chat.lastMessage?.userId !== user.uid) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [chats, chatMetadata, user?.uid]);

  const stateValue = useMemo(() => ({
    chats,
    unreadChatCount,
    chatMetadata,
    fetchChats,
    isNotificationsOpen,
  }), [chats, unreadChatCount, chatMetadata, fetchChats, isNotificationsOpen]);

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
    setIsNotificationsOpen,
    onCloseNotifications: () => setIsNotificationsOpen(false),
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