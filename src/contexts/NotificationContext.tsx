'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth/auth-provider';
import { processAndRescheduleNotification } from '@/services/firestore';
// CORRECTED: Using the correct named import as confirmed from the source file.
import { ChatNotification } from '@/components/notifications/ChatNotification'; 
import { LocalNotifications, PermissionStatus } from '@capacitor/local-notifications';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { getScheduledRemindersAction } from '@/app/notifications/actions';

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

type SerializedInAppMessage = Omit<InAppMessage, 'scheduledAt'> & { scheduledAt: string };

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

  // --- NATIVE-ONLY FUNCTIONALITY ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showNativeNotification = async (notification: InAppMessage) => {
      try {
        let permStatus: PermissionStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          permStatus = await LocalNotifications.requestPermissions();
        }
        if (permStatus.display === 'granted') {
          await LocalNotifications.schedule({
            notifications: [{
              id: new Date().getTime(),
              title: notification.title,
              body: notification.message,
              channelId: 'reminders',
              smallIcon: 'ic_stat_icon_config_default',
            }],
          });
        } else {
          console.error('User denied notification permissions.');
        }
      } catch (e) {
        console.error('Error scheduling native notification:', e);
      }
    };

    const foregroundListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
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
    
    const tapListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push notification action performed:', action);
    });

    return () => {
      foregroundListener.remove();
      tapListener.remove();
    };
  }, []);

  // --- SECURE DATA FETCHING ---
  useEffect(() => {
    if (!user) {
      setPendingNotifications([]);
      setBannerNotification(null);
      setStickyNotifications([]);
      setProcessedIds(new Set());
      return;
    }

    const fetchReminders = async () => {
        const result = await getScheduledRemindersAction(user.uid);
        if (result.success && result.data) {
            const reminders: InAppMessage[] = result.data.map((item: SerializedInAppMessage) => ({
                ...item,
                scheduledAt: Timestamp.fromDate(new Date(item.scheduledAt)),
            }));
            setPendingNotifications(reminders);
        } else {
            console.error("Could not fetch scheduled reminders:", result.error);
        }
    };

    fetchReminders();
    const pollInterval = setInterval(fetchReminders, 60000);
    return () => clearInterval(pollInterval);
  }, [user]);

  // --- NOTIFICATION PROCESSING LOGIC ---
  useEffect(() => {
    const checkDueNotifications = () => {
        if (!user || pendingNotifications.length === 0) return;

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
                
                if (Capacitor.isNativePlatform()) {
                    console.log("Would show native notification for scheduled reminder.");
                }
                
                processAndRescheduleNotification(user.uid, notification.id);
            });

            setProcessedIds(newProcessedIds);
        }
    };

    const processingInterval = setInterval(checkDueNotifications, 10000);

    return () => clearInterval(processingInterval);
  }, [pendingNotifications, user, processedIds]);


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