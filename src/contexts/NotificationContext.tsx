'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { processAndRescheduleNotification } from '@/services/firestore';

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
  const [notifications, setNotifications] = useState<InAppMessage[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<InAppMessage[]>([]);
  const { user } = useAuth();
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Step 1: Listen for all 'scheduled' notifications for the user
  useEffect(() => {
    if (!user) {
      setPendingNotifications([]);
      setNotifications([]);
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
    }, (error) => {
      console.error("Error listening to scheduled reminders:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Step 2: Timer to check pending notifications and trigger processing via server action
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!user) return;

      const now = new Date();
      // Find notifications that are due and haven't been processed in this session
      const dueNotifications = pendingNotifications.filter(n => n.scheduledAt.toDate() <= now && !processedIds.has(n.id));

      if (dueNotifications.length > 0) {
        // Add to UI to be displayed
        setNotifications(prev => {
          const newNotifications = dueNotifications.filter(due => !prev.some(existing => existing.id === due.id));
          return [...prev, ...newNotifications];
        });

        // Mark as processed locally to prevent re-triggering the pop-up
        setProcessedIds(prev => {
          const newSet = new Set(prev);
          dueNotifications.forEach(n => newSet.add(n.id));
          return newSet;
        });

        // For each due notification, call the secure server action to handle all DB updates
        dueNotifications.forEach(notification => {
          processAndRescheduleNotification(user.uid, notification.id);
        });
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(intervalId);
  }, [pendingNotifications, user, processedIds]);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
