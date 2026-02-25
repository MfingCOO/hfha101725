'use client';

import { useEffect } from 'react';
import { useNotificationStore } from '@/store/notification-store';
import { useChatModalStore, useWorkoutModalStore, useCalendarStore } from '@/store/ui-store';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';

export const NotificationActionHandler = () => {
  // --- Getters and Setters from our new notification state ---
  const {
    notificationChatId,
    setNotificationChatId,
    notificationAppointmentId,
    setNotificationAppointmentId,
    notificationWorkoutId,
    setNotificationWorkoutId,
    triggerHydrationModal,
    setTriggerHydrationModal,
  } = useNotificationStore();

  // --- Get the modal-opening actions from the UI stores ---
  const { openModal: openChatModal } = useChatModalStore();
  const { openModal: openWorkoutModal } = useWorkoutModalStore();
  const { openModal: openDataEntryModal } = useDataEntryModal();
  const { onOpen: onOpenCalendar } = useCalendarStore();

  // --- useEffect hook for Chat Notifications ---
  useEffect(() => {
    if (notificationChatId) {
      console.log(`Handler: Detected notificationChatId (${notificationChatId}), opening modal.`);
      openChatModal(notificationChatId);
      setNotificationChatId(null); // Reset state immediately
    }
  }, [notificationChatId, openChatModal, setNotificationChatId]);

  // --- useEffect hook for Appointment Notifications ---
  useEffect(() => {
    if (notificationAppointmentId) {
      console.log(`Handler: Detected notificationAppointmentId (${notificationAppointmentId}), opening calendar.`);
      onOpenCalendar(notificationAppointmentId);
      setNotificationAppointmentId(null); // Reset state immediately
    }
  }, [notificationAppointmentId, onOpenCalendar, setNotificationAppointmentId]);

  // --- useEffect hook for Workout Notifications ---
  useEffect(() => {
    if (notificationWorkoutId) {
      console.log(`Handler: Detected notificationWorkoutId (${notificationWorkoutId}), opening modal.`);
      openWorkoutModal(notificationWorkoutId);
      setNotificationWorkoutId(null); // Reset state immediately
    }
  }, [notificationWorkoutId, openWorkoutModal, setNotificationWorkoutId]);

  // --- useEffect hook for Hydration Notifications ---
  useEffect(() => {
    if (triggerHydrationModal) {
      console.log('Handler: Detected hydration trigger, opening modal.');
      openDataEntryModal('hydration');
      setTriggerHydrationModal(false); // Reset state immediately
    }
  }, [triggerHydrationModal, openDataEntryModal, setTriggerHydrationModal]);

  return null; // This is a provider component, it does not render anything.
};
