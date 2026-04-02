'use client';

import { create } from 'zustand';
import { type MessagePayload } from 'firebase/messaging';

interface NotificationState {
  notifications: MessagePayload[];
  addNotification: (notification: MessagePayload) => void;
  clearNotifications: () => void;
  notificationChatId: string | null;
  setNotificationChatId: (id: string | null) => void;
  notificationAppointmentId: string | null;
  setNotificationAppointmentId: (id: string | null) => void;
  notificationWorkoutId: string | null;
  setNotificationWorkoutId: (id: string | null) => void;
  triggerHydrationModal: boolean;
  setTriggerHydrationModal: (trigger: boolean) => void;
  hasUnreadNotifications: boolean;
  setHasUnreadNotifications: (status: boolean) => void;
  notificationIndulgenceId: string | null;
  setNotificationIndulgenceId: (id: string | null) => void;
  openChallengeList: boolean;
  setOpenChallengeList: (status: boolean) => void;
  // ADDED: The global flag to signal when RevenueCat is ready.
  isRevenueCatReady: boolean;
  setIsRevenueCatReady: (isReady: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
  clearNotifications: () => set({ notifications: [] }),
  notificationChatId: null,
  setNotificationChatId: (id) => set({ notificationChatId: id }),
  notificationAppointmentId: null,
  setNotificationAppointmentId: (id) => set({ notificationAppointmentId: id }),
  notificationWorkoutId: null,
  setNotificationWorkoutId: (id) => set({ notificationWorkoutId: id }),
  triggerHydrationModal: false,
  setTriggerHydrationModal: (trigger) => set({ triggerHydrationModal: trigger }),
  hasUnreadNotifications: false,
  setHasUnreadNotifications: (status) => set({ hasUnreadNotifications: status }),
  notificationIndulgenceId: null,
  setNotificationIndulgenceId: (id) => set({ notificationIndulgenceId: id }),
  openChallengeList: false,
  setOpenChallengeList: (status) => set({ openChallengeList: status }),
  // ADDED: The initial state and setter for the new flag.
  isRevenueCatReady: false,
  setIsRevenueCatReady: (isReady) => set({ isRevenueCatReady: isReady }),
}));
