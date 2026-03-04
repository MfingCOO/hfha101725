'use client';

import { create } from 'zustand';

// Store for the Chat Modal
interface ChatModalState {
  isOpen: boolean;
  entityId: string | undefined;
  openModal: (entityId?: string) => void;
  closeModal: () => void;
}

// FIX: Use functional set state to ensure reactivity
export const useChatModalStore = create<ChatModalState>((set) => ({
  isOpen: false,
  entityId: undefined,
  openModal: (id) => set((state) => ({ ...state, isOpen: true, entityId: id })),
  closeModal: () => set((state) => ({ ...state, isOpen: false, entityId: undefined }))
}));

// Store for the Workout Modal
interface WorkoutModalState {
  isOpen: boolean;
  entityId: string | null;
  openModal: (entityId: string | null) => void;
  closeModal: () => void;
}

// FIX: Use functional set state for consistency
export const useWorkoutModalStore = create<WorkoutModalState>((set) => ({
  isOpen: false,
  entityId: null,
  openModal: (id) => set((state) => ({ ...state, isOpen: true, entityId: id })),
  closeModal: () => set((state) => ({ ...state, isOpen: false, entityId: null }))
}));

// Store for the Calendar Modal
interface CalendarStore {
    isOpen: boolean;
    eventId: string | null;
    onOpen: (eventId?: string | null) => void;
    onClose: () => void;
}

// FIX: Use functional set state for consistency
export const useCalendarStore = create<CalendarStore>((set) => ({
    isOpen: false,
    eventId: null,
    onOpen: (id = null) => set((state) => ({...state, isOpen: true, eventId: id})),
    onClose: () => set((state) => ({...state, isOpen: false, eventId: null})),
}));
