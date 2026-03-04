'use client';

import { ChallengeList } from './challenge-list';
import { BaseModal } from '@/components/ui/base-modal';
import { Loader2 } from 'lucide-react';
import type { Challenge, ClientProfile } from '@/types';

interface ChallengesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  challenges: Challenge[];
  userProfile: ClientProfile;
  isLoading: boolean; // Add isLoading prop
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
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <ChallengeList challenges={challenges} userProfile={userProfile} />
      )}
    </BaseModal>
  );
}