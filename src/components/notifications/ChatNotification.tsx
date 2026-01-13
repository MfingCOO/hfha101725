'use client';

import React, { useEffect } from 'react';
import { InAppMessage } from '@/contexts/NotificationContext';

interface ChatNotificationProps {
  notification: InAppMessage;
  onClose: () => void;
}

export const ChatNotification: React.FC<ChatNotificationProps> = ({ notification, onClose }) => {
  if (!notification) return null;

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  // Dismiss on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={handleBackdropClick}
    >
      {/* --- Final, Polished Modal UI -- */}
      <div className="bg-slate-900 text-white p-8 rounded-lg shadow-xl w-[90vw] max-w-md flex flex-col justify-center items-center text-center">
        
        <h2 className="text-2xl font-bold text-white mb-3">{notification.title}</h2>
        
        {/* Display Chat Name, if available */}
        {notification.chatName && (
          <p className="text-md text-slate-400 mb-5">in: {notification.chatName}</p>
        )}

        {/* Display the message content - plain text */}
        <p className="text-lg text-slate-200">{notification.message}</p>

      </div>
    </div>
  );
};
