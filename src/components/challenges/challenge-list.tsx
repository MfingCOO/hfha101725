'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import Image from 'next/image'; // Import Image
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import type { Challenge, ClientProfile, UserTier } from "@/types";
import { ClientChallengeDetailModal } from "./client-challenge-detail-modal";

interface ChallengeListProps {
  challenges: Challenge[];
  userProfile: ClientProfile;
}

export function ChallengeList({ challenges, userProfile }: ChallengeListProps) {
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const canAccessChallenges = userProfile.tier !== 'free';

  const handleViewDetails = (challenge: Challenge) => {
    if (!canAccessChallenges) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedChallenge(challenge);
    setIsDetailModalOpen(true);
  };

  if (challenges.length === 0) {
    return (
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="font-semibold text-lg">No active challenges</h3>
          <p className="text-muted-foreground max-w-sm">
            There are no challenges available at the moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => {
        const isParticipant = challenge.participants?.includes(userProfile.uid);
        const startDate = challenge.dates?.from ? new Date(challenge.dates.from) : new Date();
        const endDate = challenge.dates?.to ? new Date(challenge.dates.to) : new Date();
        
        return (
          <Card key={challenge.id} className="flex flex-col overflow-hidden rounded-xl shadow-md transition-all hover:shadow-lg">
            <div className="relative w-full h-40 bg-muted">
              <Image
                src={challenge.thumbnailUrl || 'https://placehold.co/600x400.png'}
                alt={challenge.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant={isParticipant ? "default" : "secondary"} className="capitalize">
                  {challenge.type}
                </Badge>
              </div>
              <CardTitle className="line-clamp-1">{challenge.title}</CardTitle>
              <CardDescription className="line-clamp-2 h-10">
                {challenge.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                {challenge.participantCount || 0} participants
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant={isParticipant ? "outline" : "default"}
                onClick={() => handleViewDetails(challenge)}
              >
                {isParticipant ? "View Progress" : "Join Challenge"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        );
      })}

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