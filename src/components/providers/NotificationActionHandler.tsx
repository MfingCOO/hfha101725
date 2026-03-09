'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useChats } from '../chats/chat-provider';
import { useRouter } from 'next/navigation';

/**
 * This component is responsible for handling what happens when a user, who is already
 * inside the app, clicks on a push notification. It listens for messages from the service worker.
 */
export function NotificationActionHandler() {
  const { isCoach } = useAuth();
  const router = useRouter();
  const { openChat } = useChats();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // We only care about events that signify a notification was clicked.
      if (event.data.type !== 'notification_clicked' || !event.data.data) {
        return;
      }

      console.log('In-app notification click event received:', event.data.data);
      const { chatId, dashboardUrl } = event.data.data;

      if (chatId) {
        // The old, flawed approach was to navigate and then immediately try to open the chat,
        // causing a race condition.
        // const dashboardRoute = isCoach ? '/coach/dashboard' : '/client/dashboard';
        // router.push(dashboardRoute);
        // openChat(chatId); // This was the problem

        // THE FIX:
        // We now construct the exact same URL that would be opened if the app were in the background.
        // The ChatProvider is responsible for listening to this URL and opening the chat.
        // This ensures the page and all its contexts are loaded *before* we try to open the dialog.
        const finalUrl = `${dashboardUrl}?openChat=${chatId}`;
        router.push(finalUrl);
      }
    };

    // Listen for messages from the service worker (e.g., when a notification is clicked)
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Cleanup the event listener when the component unmounts
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
    // We depend on `isCoach` to build the correct path, and `router` to navigate.
    // `openChat` is no longer needed here, but we'll keep it as a dependency for now.
  }, [isCoach, router, openChat]);

  return null; // This is a handler component, it does not render anything visible.
}
