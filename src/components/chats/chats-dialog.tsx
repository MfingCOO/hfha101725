
'use client';

import { useChatModalStore } from '@/store/ui-store';
import { EmbeddedChatDialog } from './embedded-chat-dialog';
import { BaseModal } from '@/components/ui/base-modal';
import { ClientChatList } from './client-chat-list';

export function ChatsDialog() {
  const { isOpen, closeModal, entityId } = useChatModalStore();

  // If there's a specific chat ID from the notification, show the embedded chat view.
  if (entityId) {
    return (
      <EmbeddedChatDialog
        chatId={entityId}
        chatName="Chat" // Using a generic title as the name isn't readily available here
        isOpen={isOpen}
        onClose={closeModal}
      />
    );
  }

  // Otherwise, show the list of all chats (the original behavior).
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
