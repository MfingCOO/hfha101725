'use client';

import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';
import { Droplet } from 'lucide-react';
import Image from 'next/image';

export const NotificationPresenter: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  const { openModal } = useDataEntryModal();

  if (notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[0];

  const handleDismiss = () => {
    removeNotification(currentNotification.id);
  };

  const handleAction = () => {
    if (currentNotification.ctaType === 'openPillar' && currentNotification.pillarId) {
        openModal(currentNotification.pillarId as any);
    }
    // For both ctaUrl and ctaType, we dismiss the notification after the action.
    removeNotification(currentNotification.id);
  };

  return (
    <BaseModal isOpen={true} onClose={handleDismiss} title={"Hydration Reminder"}>
      <div className="p-4 flex flex-col items-center">
        <div className="mb-6">
            <Droplet className="h-24 w-24 text-blue-400" />
        </div>
        <div className="flex w-full space-x-2">
          <Button onClick={handleDismiss} variant="outline" className="w-full">Dismiss</Button>
          {currentNotification.ctaText && (
            <Button onClick={handleAction} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
              {currentNotification.ctaText}
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  );

};
