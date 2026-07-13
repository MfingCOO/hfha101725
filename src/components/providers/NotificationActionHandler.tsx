'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useChats } from '../chats/chat-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';

export function NotificationActionHandler() {
  const { isCoach, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openChat } = useChats();

  const {
    setNotificationChatId,
    setTriggerHydrationModal,
    setNotificationAppointmentId,
    setNotificationWorkoutId,
    setNotificationIndulgenceId,
    setOpenChallengeList,
  } = useNotificationStore();

  // Safe service worker listener (web only)
  useEffect(() => {
    console.log('[NotificationActionHandler] Component mounted');

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[NotificationActionHandler] Skipping serviceWorker listener (native platform)');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      console.log('[NotificationActionHandler] Received service worker message:', event.data);

      if (event.data.type !== 'notification_clicked' || !event.data.data) {
        return;
      }

      const data = event.data.data;
      const type = String(data.type || '').toLowerCase();

      if (type === 'custom-popup' && data.url) {
        router.push(data.url);
        return;
      }

      if (data.chatId) {
        const dashboardRoute = isCoach ? '/coach/dashboard' : '/client/dashboard';
        router.push(`${dashboardRoute}?openChat=${data.chatId}`);
        return;
      }

      if (profile?.tier === 'free') {
        console.log('[NotificationActionHandler] Free tier user - ignoring notification');
        return;
      }

      if (type === 'hydration') {
        setTriggerHydrationModal(true);
        router.push('/client/dashboard');
        return;
      }

      if (type === 'appointment_reminder' || type === 'appointment_booked') {
        const id = data.appointmentId || data.entityId;
        if (id) setNotificationAppointmentId(id);
        router.push('/client/dashboard');
        return;
      }

      if (type === 'workout_reminder') {
        const id = data.workoutId || data.entityId;
        if (id) setNotificationWorkoutId(id);
        router.push('/client/dashboard');
        return;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    console.log('[NotificationActionHandler] Service worker message listener attached');

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isCoach, profile, router, setTriggerHydrationModal, setNotificationAppointmentId, setNotificationWorkoutId]);

  // Handle deep links from URL
  useEffect(() => {
    const chatId = searchParams.get('openChat');
    if (chatId) {
      console.log('[NotificationActionHandler] Opening chat from URL param:', chatId);
      openChat(chatId);
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false });
    }
  }, [searchParams, openChat, router]);

  return null;
}