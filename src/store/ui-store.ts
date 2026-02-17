'use client';

import { create } from 'zustand';

// Store for the Chat Modal
interface ChatModalState {
  isOpen: boolean;
  entityId: string | null;
  openModal: (entityId: string | null) => void; // ** FIX: Allow null to be passed **
  closeModal: () => void;
}

export const useChatModalStore = create<ChatModalState>((set) => ({
  isOpen: false,
  entityId: null,
  openModal: (entityId) => set({ isOpen: true, entityId }),
  closeModal: () => set({ isOpen: false, entityId: null }),
}));

// Store for the Workout Modal
interface WorkoutModalState {
  isOpen: boolean;
  entityId: string | null;
  openModal: (entityId: string | null) => void; // ** FIX: Allow null to be passed for consistency **
  closeModal: () => void;
}

export const useWorkoutModalStore = create<WorkoutModalState>((set) => ({
  isOpen: false,
  entityId: null,
  openModal: (entityId) => set({ isOpen: true, entityId }),
  closeModal: () => set({ isOpen: false, entityId: null }),
}));

// You can add other modal states here as needed
