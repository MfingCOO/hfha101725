'use client';

import { ChallengeList } from './challenge-list';
import { BaseModal } from '@/components/ui/base-modal';
import { Loader2 } from 'lucide-react';
import type { Challenge, ClientProfile } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChallengesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: Challenge[];
  userProfile: ClientProfile;
  isLoading: boolean;
}

export function ChallengesDialog({ 
  isOpen, 
  onClose, 
  challenges, 
  userProfile, 
  isLoading
}: ChallengesDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Community Challenges"
      description="Join group challenges, track your progress, and stay motivated."
    >
      <ScrollArea className="h-[60vh]">
        <div className="flex justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <ChallengeList challenges={challenges} userProfile={userProfile} />
            </div>
          )}
        </div>
      </ScrollArea>
    </BaseModal>
  );
}
