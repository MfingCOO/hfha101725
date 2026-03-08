'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/store/notification-store';
import { useDashboardActions, useDashboardState } from '@/contexts/DashboardActionsContext';
import { BaseModal } from '@/components/ui/base-modal';

export function NotificationsDialog() {
  const { isNotificationsOpen } = useDashboardState();
  const { setIsNotificationsOpen } = useDashboardActions();
  const { setHasUnreadNotifications } = useNotificationStore();

  useEffect(() => {
    if (isNotificationsOpen) {
      setHasUnreadNotifications(false);
    }
  }, [isNotificationsOpen, setHasUnreadNotifications]);

  const handleClose = () => {
    setIsNotificationsOpen(false);
  };

  return (
    <BaseModal
        isOpen={isNotificationsOpen}
        onClose={handleClose}
        title="Notifications"
        description="Here are your latest updates. This feature is currently under construction."
        footer={
            <Button onClick={handleClose} className="w-full sm:w-auto">Close</Button>
        }
    >
        <div className="my-4 text-center">
            <p className="text-muted-foreground">No new notifications.</p>
        </div>
    </BaseModal>
  );
}
