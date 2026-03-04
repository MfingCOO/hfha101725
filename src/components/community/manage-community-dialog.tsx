'use client';

import { useState, useEffect } from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChallengeList } from '@/components/challenges/challenge-list';
import { LiveEventsTab } from '@/app/coach/events/LiveEventsTab';
import { ProgramBuilderTabs } from '@/components/coach/program-builder/program-builder-tabs';
import { useAuth } from '@/components/auth/auth-provider';
import { Challenge, ClientProfile } from '@/types';

interface ManageCommunityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageCommunityDialog({ isOpen, onClose }: ManageCommunityDialogProps) {
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  // Appearance and function remains identical; we are simply providing 
  // the required data props to the ChallengeList component.
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Community & Programs"
      description="Engage your community and build your comprehensive fitness programs."
      className="max-w-4xl"
    >
      <Tabs defaultValue="community" className="w-full pt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="program-builder">Program Builder</TabsTrigger>
        </TabsList>
        
        {/* Community Tab Content */}
        <TabsContent value="community">
          <Tabs defaultValue="challenges" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenges">Challenges</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>
            <TabsContent value="challenges">
              {/* FIX: Passing the required challenges and userProfile props */}
              <ChallengeList 
                challenges={challenges} 
                userProfile={profile as ClientProfile} 
              />
            </TabsContent>
            <TabsContent value="events">
              <LiveEventsTab />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Program Builder Tab Content */}
        <TabsContent value="program-builder">
          <ProgramBuilderTabs />
        </TabsContent>
      </Tabs>
    </BaseModal>
  );
}