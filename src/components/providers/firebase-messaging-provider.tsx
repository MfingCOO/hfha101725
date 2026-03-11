'use client';

import { useEffect } from 'react';
import { getMessaging, onMessage } from 'firebase/messaging';
import { app } from '@/lib/firebase';
import { useNotificationStore } from '@/store/notification-store';
import { toast } from 'sonner';

// This component is responsible for handling foreground push notifications.
export function FirebaseMessagingProvider({ children }: { children: React.ReactNode }) {
  const { addNotification, setHasUnreadNotifications } = useNotificationStore();

  useEffect(() => {
    // This effect should only run once on the client.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const messaging = getMessaging(app);

      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);

        // Add the notification to our central store.
        addNotification(payload);
        
        // Set the unread notification status to true.
        setHasUnreadNotifications(true);

        // Show a toast notification to the user.
        if (payload.notification) {
          toast.info(payload.notification.title, {
            description: payload.notification.body,
          });
        }
      });

      // Cleanup subscription on component unmount.
      return () => {
        unsubscribe();
      };
    }
  }, [addNotification, setHasUnreadNotifications]);

  return <>{children}</>;
}
