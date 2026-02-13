'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { processAndRescheduleNotification } from '@/services/firestore';
import { ChatNotification } from '@/components/notifications/ChatNotification';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications'; // <-- THE MISSING IMPORT IS ADDED HERE

export interface InAppMessage {
  id: string;
  type: string;
  title: string;
  message: string;
  scheduledAt: Timestamp;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;
  ctaType?: 'openUrl' | 'openPillar';
  pillarId?: string;
  isRecurring?: boolean;
  chatName?: string;
}

interface NotificationContextType {
  notifications: InAppMessage[];
  removeNotification: (notificationId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [pendingNotifications, setPendingNotifications] = useState<InAppMessage[]>([]);
  const { user } = useAuth();
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  const [bannerNotification, setBannerNotification] = useState<InAppMessage | null>(null);
  const [stickyNotifications, setStickyNotifications] = useState<InAppMessage[]>([]);

  const showNativeNotification = async (notification: InAppMessage) => {
    try {
      let permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
      }

      if (permStatus.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: new Date().getTime(),
              title: notification.title,
              body: notification.message,
              channelId: 'reminders',
              smallIcon: 'ic_stat_icon_config_default',
            },
          ],
        });
        console.log('Native notification scheduled successfully.');
      } else {
        console.error('User denied notification permissions.');
      }
    } catch (e) {
      console.error('Error scheduling native notification:', e);
    }
  };

  useEffect(() => {
    if (!user) {
      setPendingNotifications([]);
      setBannerNotification(null);
      setStickyNotifications([]);
      setProcessedIds(new Set());
      return;
    }

    const q = query(
      collection(db, 'user_scheduled_reminders'),
      where('userId', '==', user.uid),
      where('status', '==', 'scheduled')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InAppMessage));
      setPendingNotifications(pending);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!user) return;

      const now = new Date();
      const dueNotifications = pendingNotifications.filter(n => 
        n.scheduledAt.toDate() <= now && !processedIds.has(n.id)
      );

      if (dueNotifications.length > 0) {
        const newProcessedIds = new Set(processedIds);

        dueNotifications.forEach(notification => {
          newProcessedIds.add(notification.id);

          if (notification.type === 'hydration_reminder' || notification.type === 'chat_message') {
            setBannerNotification(notification);
          } else {
            setStickyNotifications(prev => [...prev, notification]);
          }
          
          showNativeNotification(notification);
          
          processAndRescheduleNotification(user.uid, notification.id);
        });

        setProcessedIds(newProcessedIds);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [pendingNotifications, user, processedIds]);

  // This new listener handles LIVE push notifications that arrive while the app is in the foreground
  useEffect(() => {
    const listener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Foreground push notification received:', notification);

      const bannerData: InAppMessage = {
        id: notification.id || new Date().toISOString(),
        type: 'chat_message',
        title: notification.title || 'New Message',
        message: notification.body || '',
        chatName: notification.data?.chatName || '',
        scheduledAt: Timestamp.now(),
      };

      setBannerNotification(bannerData);
    });

    return () => {
      listener.remove();
    };
  }, []);

  const handleCloseBannerNotification = () => {
    setBannerNotification(null);
  };

  const removeStickyNotification = useCallback((id: string) => {
    setStickyNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications: stickyNotifications, removeNotification: removeStickyNotification }}>
      {children}
      {bannerNotification && (
        <ChatNotification 
          notification={bannerNotification} 
          onClose={handleCloseBannerNotification} 
        />
      )}
    </NotificationContext.Provider>
  );
};