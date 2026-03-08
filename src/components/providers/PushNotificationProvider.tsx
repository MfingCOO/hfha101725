'use client';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { toast } from '@/hooks/use-toast';
import { saveFcmToken } from '@/app/notifications/actions';
import { getMessaging, onMessage } from 'firebase/messaging';
import { app } from '@/lib/firebase';
import { useNotificationStore } from '@/store/notification-store';

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { setHasUnreadNotifications } = useNotificationStore();

  useEffect(() => {
    if (loading || !user) return;

    const setupNotifications = async () => {
      // For native platforms (iOS/Android)
      if (Capacitor.isNativePlatform()) {
        await PushNotifications.requestPermissions();
        await PushNotifications.register();

        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success, token: ', token.value);
          saveFcmToken(user.uid, token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ', JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push received: ', notification);
          setHasUnreadNotifications(true);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push action performed: ', notification);
        });

        return () => {
          PushNotifications.removeAllListeners();
        };
      }
      // For web platform (PWA)
      else {
        const messaging = getMessaging(app);
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('Notification permission granted.');
          }
        });

        // --- Foreground message handler ---
        const unsubscribeOnMessage = onMessage(messaging, (payload) => {
          console.log('Foreground message received.', payload);
          setHasUnreadNotifications(true);

          const { title, body, imageUrl } = payload.data || {};
          
          if (title && body) {
            const notificationOptions = {
              body: body,
              icon: imageUrl || '/logo.png', 
              data: payload.data
            };
            
            const notification = new Notification(title, notificationOptions);

            notification.onclick = (event) => {
              event.preventDefault();
              const url = (event.currentTarget as Notification).data?.url;
              if (url) {
                window.open(url, '_blank');
              }
              notification.close();
            };
          } else {
            toast({ title: 'New Notification', description: 'You have a new message.' });
          }
        });

        // --- Service Worker message listener ---
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
                console.log('Received notification click event from service worker.');
                setHasUnreadNotifications(true);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

        return () => {
          unsubscribeOnMessage();
          navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        };
      }
    };

    const cleanup = setupNotifications();

    return () => {
      if (cleanup) {
        cleanup.then(fn => fn && fn());
      }
    };
  }, [user, loading, setHasUnreadNotifications]);

  return <>{children}</>;
};

export default PushNotificationProvider;
