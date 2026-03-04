'use client';

import React, { useEffect } from 'react';
// This will now work because we added it to @/types
import { InAppMessage } from '@/types'; 

interface ChatNotificationProps {
  notification: InAppMessage | null;
  onClose: () => void;
}

export const ChatNotification: React.FC<ChatNotificationProps> = ({ notification, onClose }) => {
  // Guard clause: if no notification, render nothing
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
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] transition-opacity duration-300 animate-in fade-in"
      onClick={handleBackdropClick}
    >
      {/* --- Final, Polished Modal UI -- */}
      <div 
        className="bg-slate-900 text-white p-8 rounded-2xl shadow-2xl w-[90vw] max-w-md flex flex-col justify-center items-center text-center border border-slate-800 animate-in zoom-in-95 duration-200"
      >
        <h2 className="text-2xl font-bold text-white mb-2">{notification.title}</h2>
        
        {/* Display Chat Name, if available */}
        {notification.chatName && (
          <p className="text-sm font-medium text-primary mb-4">in: {notification.chatName}</p>
        )}

        {/* Display the message content - plain text */}
        <p className="text-lg text-slate-200 leading-relaxed italic">
          "{notification.message}"
        </p>

        <button 
          onClick={onClose}
          className="mt-6 text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
        >
          Tap to dismiss
        </button>
      </div>
    </div>
  );
};