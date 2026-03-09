'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { saveFcmToken } from '@/app/notifications/actions';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationHandler() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
      console.log('[PushHandler] Initializing for user:', user.uid);

      const initializeMessaging = async () => {
        try {
          // Get the service worker registration.
          const serviceWorkerRegistration = await navigator.serviceWorker.ready;
          console.log('[PushHandler] Service Worker is ready.');

          const messaging = getMessaging(app);
          console.log('[PushHandler] Firebase Messaging initialized.');

          // 1. Request permission
          console.log('[PushHandler] Requesting notification permission...');
          const permission = await Notification.requestPermission();
          console.log('[PushHandler] Permission status:', permission);

          if (permission === 'granted') {
            // 2. Get token
            console.log('[PushHandler] Getting FCM token...');
            const fcmToken = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: serviceWorkerRegistration, // Specify the SW registration
            });

            if (fcmToken) {
              console.log('[PushHandler] Successfully got FCM Token:', fcmToken);
              // 3. Save the token to the server
              console.log('[PushHandler] Saving FCM token to server...');
              const result = await saveFcmToken(user.uid, fcmToken);
              if (result.success) {
                console.log('[PushHandler] Successfully saved FCM token to server.');
              } else {
                console.error('[PushHandler] FAILED to save FCM token:', result.error);
              }

              // 4. Handle foreground messages
              onMessage(messaging, (payload) => {
                console.log('[PushHandler] Foreground message received:', payload);
                toast({
                  title: payload.notification?.title,
                  description: payload.notification?.body,
                });
              });

            } else {
              console.error('[PushHandler] FAILED to get FCM token. No registration token available.');
            }
          } else {
            console.warn('[PushHandler] Notification permission not granted.');
          }
        } catch (error) {
          console.error('[PushHandler] An error occurred during initialization:', error);
        }
      };

      initializeMessaging();
    }
  }, [user, toast]);

  return null; // This component does not render anything
}
