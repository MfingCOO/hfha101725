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

  // Safe service worker listener (only runs on web/PWA)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return; // Skip on native iOS/Android
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type !== 'notification_clicked' || !event.data.data) {
        return;
      }

      console.log('📬 Notification clicked:', event.data.data);

      const data = event.data.data;
      const type = String(data.type || '').toLowerCase();

      // CUSTOM POPUP
      if (type === 'custom-popup' && data.url) {
        console.log('📢 Opening custom popup');
        router.push(data.url);
        return;
      }

      // CHAT
      if (data.chatId) {
        const dashboardRoute = isCoach ? '/coach/dashboard' : '/client/dashboard';
        router.push(`${dashboardRoute}?openChat=${data.chatId}`);
        return;
      }

      // Everything else (only for paid users)
      if (profile?.tier === 'free') {
        console.log('🔒 Free tier user - ignoring notification type:', type);
        return;
      }

      if (type === 'hydration') {
        console.log('💧 Opening hydration popup');
        setTriggerHydrationModal(true);
        router.push('/client/dashboard');
        return;
      }

      if (type === 'appointment_reminder' || type === 'appointment_booked') {
        console.log('📅 Opening calendar for appointment');
        const id = data.appointmentId || data.entityId;
        if (id) setNotificationAppointmentId(id);
        router.push('/client/dashboard');
        return;
      }

      if (type === 'workout_reminder') {
        console.log('🏋️ Opening calendar for workout');
        const id = data.workoutId || data.entityId;
        if (id) setNotificationWorkoutId(id);
        router.push('/client/dashboard');
        return;
      }

      console.log('⚠️ Unhandled notification type:', type);
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isCoach, profile, router, setTriggerHydrationModal, setNotificationAppointmentId, setNotificationWorkoutId]);

  // Handle deep links from URL params
  useEffect(() => {
    const chatId = searchParams.get('openChat');
    if (chatId) {
      openChat(chatId);
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false });
    }
  }, [searchParams, openChat, router]);

  return null;
}