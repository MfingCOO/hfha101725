'use client';

import { ChallengeList } from '@/components/challenges/challenge-list';
import { BaseModal } from '@/components/ui/base-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseLibrary } from '@/components/coach/exercise-library/exercise-library'; // Placeholder for now

interface ManageCommunityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageCommunityDialog({ isOpen, onClose }: ManageCommunityDialogProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Community"
      description="Manage community challenges and your workout program library."
    >
      <Tabs defaultValue="challenges" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="exercises">Exercise Library</TabsTrigger>
        </TabsList>
        <TabsContent value="challenges">
            <ChallengeList />
        </TabsContent>
        <TabsContent value="exercises">
            <ExerciseLibrary />
        </TabsContent>
      </Tabs>
    </BaseModal>
  );
}
