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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Community & Programs"
      description="Engage your community and build your comprehensive fitness programs."
      className="max-w-4xl"
    >
      <Tabs defaultValue="community" className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="community">Community</TabsTrigger>
          <TabsTrigger value="program-builder">Program Builder</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 min-h-0">
            <TabsContent value="community" className="p-4 h-full flex flex-col">
              <Tabs defaultValue="challenges" className="w-full h-full flex flex-col">
                <div className="flex justify-center">
                  <TabsList>
                    <TabsTrigger value="challenges">Challenges</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto pt-4">
                    <TabsContent value="challenges" className="m-0">
                      <ChallengeList 
                        challenges={challenges} 
                        userProfile={profile as ClientProfile} 
                      />
                    </TabsContent>
                    <TabsContent value="events" className="m-0">
                      <LiveEventsTab />
                    </TabsContent>
                </div>
              </Tabs>
            </TabsContent>

            <TabsContent value="program-builder" className="p-4 h-full overflow-y-auto">
              <ProgramBuilderTabs />
            </TabsContent>
        </div>
      </Tabs>
    </BaseModal>
  );
}