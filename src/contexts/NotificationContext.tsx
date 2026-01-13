'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { processAndRescheduleNotification } from '@/services/firestore';
import { ChatNotification } from '@/components/notifications/ChatNotification';

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

  // Separate states for different notification UIs
  const [chatNotification, setChatNotification] = useState<InAppMessage | null>(null);
  const [stickyNotifications, setStickyNotifications] = useState<InAppMessage[]>([]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Listen for scheduled notifications from Firestore
  useEffect(() => {
    if (!user) {
      setPendingNotifications([]);
      setChatNotification(null);
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

  // Timer to process due notifications
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

          // --- ROUTE NOTIFICATION BY TYPE ---
          if (notification.type === 'chat_message') {
            setChatNotification(notification);
          } else {
            // Add to the list for the NotificationPresenter
            setStickyNotifications(prev => [...prev, notification]);
          }

          // Trigger browser notification for all types
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: notification.imageUrl || '/logo.png',
            });
          }
          
          processAndRescheduleNotification(user.uid, notification.id);
        });

        setProcessedIds(newProcessedIds);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [pendingNotifications, user, processedIds]);

  // Function to close the temporary chat notification
  const handleCloseChatNotification = () => {
    setChatNotification(null);
  };

  // Function to dismiss a sticky notification from the NotificationPresenter
  const removeStickyNotification = useCallback((id: string) => {
    setStickyNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications: stickyNotifications, removeNotification: removeStickyNotification }}>
      {children}
      {chatNotification && (
        <ChatNotification 
          notification={chatNotification} 
          onClose={handleCloseChatNotification} 
        />
      )}
    </NotificationContext.Provider>
  );
};
