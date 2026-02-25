'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { broadcastMiaMessageAction } from '@/app/coach/chats/actions';

interface MiaMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  miaChatIds: string[];
}

export function MiaMessageDialog({ open, onOpenChange, miaChatIds }: MiaMessageDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const miaCount = miaChatIds.length;

  const handleSend = async () => {
    if (!user || !message) return;

    setIsSending(true);
    try {
        const result = await broadcastMiaMessageAction({ message, coachId: user.uid, chatIds: miaChatIds });
        if (result.success) {
            toast({
                title: 'Message Broadcast Successful',
                description: `Your message was sent to ${result.count} clients.`,
            });
            onOpenChange(false);
            setMessage('');
        } else {
            throw new Error(result.error?.message || 'An unknown error occurred.');
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Broadcast Failed',
            description: error.message,
        });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Broadcast MIA Message</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message here. It will be sent to all clients who have not responded in over 48 hours."
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !message || miaCount === 0}
          >
            {isSending ? 'Sending...' : `Send to ${miaCount} Client(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
