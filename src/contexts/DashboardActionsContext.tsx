'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Chat } from '@/services/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { getChatsForClient, getChatMetadataForUser } from '@/app/chats/actions';

/**
 * Safely converts various timestamp formats to milliseconds since epoch.
 * Handles Firestore Timestamps, JS Date objects, ISO strings, and numbers.
 */
function getMillis(timestamp: any): number {
    if (!timestamp) return 0;
    // Firestore Timestamp object
    if (typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
    }
    // JavaScript Date object
    if (typeof timestamp.getTime === 'function') {
        return timestamp.getTime();
    }
    // ISO-8601 string
    if (typeof timestamp === 'string') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    // Number (already in milliseconds)
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    return 0;
}

// 1. Define the types for the state and actions
interface DashboardState {
  chats: Chat[];
  hasUnreadChats: boolean;
  fetchChats: () => void;
}

interface DashboardActions {
  onOpenChallenges: () => void;
  onOpenChats: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
  isChallengesOpen: boolean;
  isChatsOpen: boolean;
  isCalendarOpen: boolean;
  isSettingsOpen: boolean;
  onCloseChallenges: () => void;
  onCloseChats: () => void;
  onCloseCalendar: () => void;
  onCloseSettings: () => void;
}

// 2. Create two separate contexts
const DashboardStateContext = createContext<DashboardState | undefined>(undefined);
const DashboardActionsContext = createContext<DashboardActions | undefined>(undefined);

// 3. Create a single provider that manages everything
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // State for the data
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatMetadata, setChatMetadata] = useState<Record<string, { lastReadTimestamp: any }>>({});

  // State for the UI actions (dialogs)
  const [isChallengesOpen, setIsChallengesOpen] = useState(false);
  const [isChatsOpen, setIsChatsOpen] = useState(false);
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
        if (!lastMessage || !lastMessage.senderId || !lastMessage.timestamp) {
            return false;
        }

        if (lastMessage.senderId === user.uid) {
            return false;
        }

        const lastReadTimestamp = chatMetadata[chat.id]?.lastReadTimestamp;
        const lastMessageMillis = getMillis(lastMessage.timestamp);

        if (!lastReadTimestamp) {
            return lastMessageMillis > 0;
        }
        
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
    onOpenChats: () => setIsChatsOpen(true),
    onOpenCalendar: () => setIsCalendarOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
    isChallengesOpen,
    isChatsOpen,
    isCalendarOpen,
    isSettingsOpen,
    onCloseChallenges: () => setIsChallengesOpen(false),
    onCloseChats: () => setIsChatsOpen(false),
    onCloseCalendar: () => setIsCalendarOpen(false),
    onCloseSettings: () => setIsSettingsOpen(false),
  }), [isChallengesOpen, isChatsOpen, isCalendarOpen, isSettingsOpen]);

  return (
    <DashboardStateContext.Provider value={stateValue}>
      <DashboardActionsContext.Provider value={actionsValue}>
        {children}
      </DashboardActionsContext.Provider>
    </DashboardStateContext.Provider>
  );
}

// 4. Create separate hooks for consuming the state and actions
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
