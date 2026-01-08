'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, query, where, onSnapshot, Timestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';

export interface InAppMessage {
  id: string;
  type: string;
  title: string;
  message: string;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;
  scheduledAt: Timestamp;
}

interface NotificationContextType {
  notifications: InAppMessage[];
  addNotification: (notification: InAppMessage) => void;
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

  // Step 1: Fetch all 'scheduled' notifications from Firestore for the current user.
  useEffect(() => {
    if (!user) {
      setPendingNotifications([]);
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'user_scheduled_reminders'),
      where('userId', '==', user.uid),
      where('status', '==', 'scheduled')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending: InAppMessage[] = [];
      snapshot.forEach(doc => {
        if (!pending.some(n => n.id === doc.id)) {
          const data = doc.data();
          pending.push({
            id: doc.id,
            ...data,
          } as InAppMessage);
        }
      });
      setPendingNotifications(pending);
    });

    return () => unsubscribe();
  }, [user]);

  // Step 2: Use a timer to check every minute if any pending notifications are due to be shown.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const dueNotifications: InAppMessage[] = [];

      pendingNotifications.forEach(notification => {
        if (notification.scheduledAt.toDate() <= now) {
          dueNotifications.push(notification);
        }
      });

      if (dueNotifications.length > 0) {
        // Add the due notifications to the visible list
        setNotifications(prev => {
            const newNotifications = dueNotifications.filter(due => !prev.some(existing => existing.id === due.id));
            return [...prev, ...newNotifications];
        });

        // Remove them from the pending list so we don't process them again
        setPendingNotifications(prev => prev.filter(n => !dueNotifications.some(due => due.id === n.id)));

        // Mark them as 'delivered' in the database in a batch
        const batch = writeBatch(db);
        dueNotifications.forEach(n => {
          const notifRef = doc(db, 'user_scheduled_reminders', n.id);
          batch.update(notifRef, { status: 'delivered' });
        });
        batch.commit().catch(error => console.error("Error marking notifications as delivered: ", error));
      }
    }, 60000); // Check every minute

    return () => clearInterval(intervalId); // Clean up the interval on component unmount
  }, [pendingNotifications]);


  const addNotification = useCallback((notification: InAppMessage) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      return [...prev, notification];
    });
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
