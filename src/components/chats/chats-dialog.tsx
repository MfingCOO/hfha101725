
'use client';

import { BaseModal } from '@/components/ui/base-modal';
import { ClientChatList } from './client-chat-list';
import { useChatModalStore } from '@/store/ui-store';

// ** THE FIX: This component now controls its own state by subscribing to the global Zustand store. **
// It no longer needs to be controlled by a parent component like DialogManager.
export function ChatsDialog() {
  const { isOpen, closeModal } = useChatModalStore();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={closeModal}
      title="My Chats"
      description="All your coaching and challenge conversations."
    >
      <div className="p-4 sm:p-6">
        <ClientChatList />
      </div>
    </BaseModal>
  );
}
