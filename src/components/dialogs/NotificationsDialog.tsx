'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/store/notification-store';
import { useDashboardActions, useDashboardState } from '@/contexts/DashboardActionsContext';
import { BaseModal } from '@/components/ui/base-modal';

export function NotificationsDialog() {
  const { isNotificationsOpen } = useDashboardState();
  const { setIsNotificationsOpen } = useDashboardActions();
  const { notifications, clearNotifications, setHasUnreadNotifications } = useNotificationStore();

  useEffect(() => {
    if (isNotificationsOpen) {
      setHasUnreadNotifications(false);
    }
  }, [isNotificationsOpen, setHasUnreadNotifications]);

  const handleClose = () => {
    setIsNotificationsOpen(false);
  };

  const handleClear = () => {
    clearNotifications();
  }

  return (
    <BaseModal
        isOpen={isNotificationsOpen}
        onClose={handleClose}
        title="Notifications"
        description="Here are your latest updates."
        footer={
          <div className="flex justify-between w-full">
            <Button onClick={handleClear} variant="outline">Clear All</Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        }
    >
      {notifications.length > 0 ? (
        <ul className="my-4 space-y-2">
          {notifications.map((notification, index) => (
            <li key={index} className="p-3 bg-gray-100 rounded-lg">
              <p className="font-bold">{notification.notification?.title}</p>
              <p>{notification.notification?.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="my-4 text-center">
            <p className="text-muted-foreground">No new notifications.</p>
        </div>
      )}
    </BaseModal>
  );
}
