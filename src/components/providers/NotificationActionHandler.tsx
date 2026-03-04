'use client';

import { useEffect } from 'react';
import { useNotificationStore } from '@/store/notification-store';
import { useChatModalStore, useWorkoutModalStore, useCalendarStore } from '@/store/ui-store';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';

export const NotificationActionHandler = () => {
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

  const { openModal: openChatModal } = useChatModalStore();
  const { openModal: openWorkoutModal } = useWorkoutModalStore();
  const { openModal: openDataEntryModal } = useDataEntryModal();
  const { onOpen: onOpenCalendar } = useCalendarStore();

  useEffect(() => {
    if (notificationChatId) {
      console.log(`Handler: Detected notificationChatId (${notificationChatId}), opening modal.`);
      openChatModal(notificationChatId);
      setNotificationChatId(null);
    }
  }, [notificationChatId, openChatModal, setNotificationChatId]);

  useEffect(() => {
    if (notificationAppointmentId) {
      console.log(`Handler: Detected notificationAppointmentId (${notificationAppointmentId}), opening calendar.`);
      onOpenCalendar(notificationAppointmentId);
      setNotificationAppointmentId(null); 
    }
  }, [notificationAppointmentId, onOpenCalendar, setNotificationAppointmentId]);

  useEffect(() => {
    if (notificationWorkoutId) {
      console.log(`Handler: Detected notificationWorkoutId (${notificationWorkoutId}), opening modal.`);
      openWorkoutModal(notificationWorkoutId);
      setNotificationWorkoutId(null); 
    }
  }, [notificationWorkoutId, openWorkoutModal, setNotificationWorkoutId]);

  useEffect(() => {
    if (triggerHydrationModal) {
      console.log('Handler: Detected hydration trigger, opening modal.');
      openDataEntryModal('hydration');
      setTriggerHydrationModal(false);
    }
  }, [triggerHydrationModal, openDataEntryModal, setTriggerHydrationModal]);

  return null;
};
