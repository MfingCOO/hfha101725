
// This is the old, incorrect type. We are keeping it temporarily to avoid breaking other parts of the app during the transition.
export interface UserProfile {
  uid: string;
  email?: string;
  fullName?: string;
  pushToken?: string; 
  tier?: UserTier;
  bingeFreeSince?: string;
  achievedStreakMilestones?: number[];
  coachId?: string;
  lastInteraction?: any;
  bedtime?: string;
  activeChallengeId?: string;
}

// **THE FIX:** This is the new, correct type for all users in the 'clients' collection.
export interface ClientProfile {
  uid: string;
  email?: string;
  fullName?: string;
  fcmTokens?: string[]; // Use the new array for multiple tokens
  tier?: UserTier;
  bingeFreeSince?: any; // Use a more flexible type for Firestore Timestamps
  achievedStreakMilestones?: number[];
  coachId?: string;
  lastInteraction?: any; // Use a more flexible type for Firestore Timestamps
  bedtime?: string;
  activeChallengeId?: string;
}

export type UserTier = 'free' | 'ad-free' | 'standard' | 'premium' | 'professional';

export interface Program {
  id: string;
  title: string;
  description: string;
  tier: UserTier;
  weeks: Week[];
}

export interface Week {
  weekId: string;
  title: string;
  days: Day[];
}

export interface Day {
  dayId: string;
  title: string;
  activities: Activity[];
}

export interface Activity {
  activityId: string;
  title: string;
  type: 'video' | 'article' | 'meditation';
  content: string; // URL for video, markdown for article, audio file URL for meditation
}
