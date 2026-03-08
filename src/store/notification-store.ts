'use client';

import { create } from 'zustand';

interface NotificationState {
  notificationChatId: string | null;
  setNotificationChatId: (id: string | null) => void;
  notificationAppointmentId: string | null;
  setNotificationAppointmentId: (id: string | null) => void;
  notificationWorkoutId: string | null;
  setNotificationWorkoutId: (id: string | null) => void;
  triggerHydrationModal: boolean;
  setTriggerHydrationModal: (trigger: boolean) => void;
  // New state for the notification bell
  hasUnreadNotifications: boolean;
  setHasUnreadNotifications: (status: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notificationChatId: null,
  setNotificationChatId: (id) => set({ notificationChatId: id }),
  notificationAppointmentId: null,
  setNotificationAppointmentId: (id) => set({ notificationAppointmentId: id }),
  notificationWorkoutId: null,
  setNotificationWorkoutId: (id) => set({ notificationWorkoutId: id }),
  triggerHydrationModal: false,
  setTriggerHydrationModal: (trigger) => set({ triggerHydrationModal: trigger }),
  // New state and setter for the notification bell
  hasUnreadNotifications: false,
  setHasUnreadNotifications: (status) => set({ hasUnreadNotifications: status }),
}));
