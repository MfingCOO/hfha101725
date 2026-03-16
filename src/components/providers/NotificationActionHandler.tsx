'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useChats } from '../chats/chat-provider';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component is responsible for handling what happens when a user, who is already
 * inside the app, clicks on a push notification. It listens for messages from the service worker.
 */
export function NotificationActionHandler() {
  const { isCoach } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openChat } = useChats();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type !== 'notification_clicked' || !event.data.data) {
        return;
      }

      console.log('In-app notification click event received:', event.data.data);
      const { chatId } = event.data.data;

      if (chatId) {
        const dashboardRoute = isCoach ? '/coach/dashboard' : '/client/dashboard';
        router.push(`${dashboardRoute}?openChat=${chatId}`);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [isCoach, router]);

  useEffect(() => {
    const chatId = searchParams.get('openChat');
    if (chatId) {
      openChat(chatId);
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false });
    }
  }, [searchParams, openChat, router]);

  return null; // This is a handler component, it does not render anything visible.
}
