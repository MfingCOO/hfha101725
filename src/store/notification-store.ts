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
  notificationIndulgenceId: string | null; // ADDED
  setNotificationIndulgenceId: (id: string | null) => void; // ADDED
  openChallengeList: boolean; // ADDED
  setOpenChallengeList: (status: boolean) => void; // ADDED
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
  notificationIndulgenceId: null, // ADDED
  setNotificationIndulgenceId: (id) => set({ notificationIndulgenceId: id }), // ADDED
  openChallengeList: false, // ADDED
  setOpenChallengeList: (status) => set({ openChallengeList: status }), // ADDED
}));
