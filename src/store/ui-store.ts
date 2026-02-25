'use client';

import { create } from 'zustand';

// Store for the Chat Modal
interface ChatModalState {
  isOpen: boolean;
  entityId: string | undefined;
  openModal: (entityId?: string) => void;
  closeModal: () => void;
}

export const useChatModalStore = create<ChatModalState>((set) => ({
  isOpen: false,
  entityId: undefined,
  openModal: (entityId) => set({ isOpen: true, entityId }),
  closeModal: () => set({ isOpen: false, entityId: undefined }),
}));

// Store for the Workout Modal
interface WorkoutModalState {
  isOpen: boolean;
  entityId: string | null;
  openModal: (entityId: string | null) => void;
  closeModal: () => void;
}

export const useWorkoutModalStore = create<WorkoutModalState>((set) => ({
  isOpen: false,
  entityId: null,
  openModal: (entityId) => set({ isOpen: true, entityId }),
  closeModal: () => set({ isOpen: false, entityId: null }),
}));

// Store for the Calendar Modal
interface CalendarStore {
    isOpen: boolean;
    eventId: string | null;
    onOpen: (eventId?: string | null) => void;
    onClose: () => void;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
    isOpen: false,
    eventId: null,
    onOpen: (eventId = null) => set({ isOpen: true, eventId }),
    onClose: () => set({ isOpen: false, eventId: null }),
}));
