'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import Image from 'next/image';
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import type { Challenge, ClientProfile, UserTier } from "@/types";
import { ClientChallengeDetailModal } from "./client-challenge-detail-modal";

interface ChallengeListProps {
  challenges: Challenge[];
  userProfile: ClientProfile;
}

const ChallengeListItem = ({ challenge, userProfile, onActionClick }: { challenge: Challenge, userProfile: ClientProfile, onActionClick: (challenge: Challenge) => void }) => {
  const startDate = challenge.dates?.from ? new Date(challenge.dates.from) : new Date();
  const endDate = challenge.dates?.to ? new Date(challenge.dates.to) : new Date();
  const isParticipant = challenge.participants?.includes(userProfile.uid);

  return (
    <div className="p-4 border border-neutral-800 rounded-lg bg-neutral-900/50">
        <div className="text-center mb-4">
            <h3 className="font-bold text-white text-base truncate">{challenge.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{challenge.description}</p>
        </div>

        <div className="flex items-center justify-center gap-5">
            <div className="relative w-24 h-24 rounded-md overflow-hidden shrink-0">
                <Image
                    src={challenge.thumbnailUrl || 'https://placehold.co/100x100.png'}
                    alt={challenge.name || 'Challenge thumbnail'} 
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>
            
            <div className="flex flex-col items-start space-y-2.5">
                  <Button 
                    size="sm"
                    className={`px-4 font-bold ${isParticipant 
                      ? 'border border-amber-400 text-amber-400 bg-transparent hover:bg-amber-400/10' 
                      : 'bg-amber-400 hover:bg-amber-500 text-neutral-900'
                    }`}
                    onClick={() => onActionClick(challenge)}
                >
                    {isParticipant ? "View Progress" : "Join"}
                </Button>

                <div className="flex items-center text-sm text-neutral-400 pt-1">
                    <Calendar className="mr-2 h-4 w-4 shrink-0" />
                    <span>{format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}</span>
                </div>
                
                <div className="flex items-center text-sm text-neutral-400">
                    <Users className="mr-2 h-4 w-4 shrink-0" />
                    <span>{challenge.participantCount || 0} participants</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export function ChallengeList({ challenges, userProfile }: ChallengeListProps) {
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const canAccessChallenges = userProfile.tier !== 'free';

  const handleActionClick = (challenge: Challenge) => {
    if (!canAccessChallenges) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedChallenge(challenge);
    setIsDetailModalOpen(true);
  };

  const joinedChallenges = challenges.filter(c => c.participants?.includes(userProfile.uid));
  const availableChallenges = challenges.filter(c => !c.participants?.includes(userProfile.uid));

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center h-full">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
        <h3 className="font-semibold text-lg text-white">No active challenges</h3>
        <p className="text-muted-foreground max-w-sm">
          There are no community challenges available at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {joinedChallenges.length > 0 && (
        <section className="w-full">
          <h3 className="text-xl font-bold text-white mb-4 text-center">My Challenges</h3>
          <div className="space-y-4">
            {joinedChallenges.map((challenge) => (
              <ChallengeListItem key={`joined-${challenge.id}`} challenge={challenge} userProfile={userProfile} onActionClick={handleActionClick} />
            ))}
          </div>
        </section>
      )}

      {availableChallenges.length > 0 && (
        <section className="w-full">
          <h3 className="text-xl font-bold text-white mb-4 text-center">Available to Join</h3>
          <div className="space-y-4">
            {availableChallenges.map((challenge) => (
              <ChallengeListItem key={`available-${challenge.id}`} challenge={challenge} userProfile={userProfile} onActionClick={handleActionClick} />
            ))}
          </div>
        </section>
      )}
      
      {selectedChallenge && (
        <ClientChallengeDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          challenge={selectedChallenge as any}
        />
      )}

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)}
        requiredTier={"premium" as UserTier}
        featureName="Community Challenges"
        reason="Challenges are part of our Premium and Coaching tiers. Upgrade to join the community and track your progress!"
      />
    </div>
  );
}
