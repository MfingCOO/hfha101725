
import { z } from 'zod';

// -----------------------------------------------------------------------------
// CORE USER & AUTH TYPES
// -----------------------------------------------------------------------------

export enum UserTier { Free = 'free', AdFree = 'ad-free', Basic = 'basic', Premium = 'premium', Coaching = 'coaching' }

// DEPRECATED: This is legacy. Use ClientProfile instead.
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

// SOURCE OF TRUTH: Represents a document in the 'clients' collection.
export interface ClientProfile {
  uid: string;
  email?: string;
  fullName?: string;
  fcmTokens?: string[];
  tier?: UserTier;
  bingeFreeSince?: any;
  achievedStreakMilestones?: number[];
  coachId?: string;
  lastInteraction?: any;
  bedtime?: string;
  activeChallengeId?: string;
  chatIds?: string[];
  hasHadCoachingChat?: boolean;
  onboarding?: any;
  stripeCustomerId?: string;
  role?: 'client' | 'coach';
  challengeIds?: string[];
  customGoals?: NutritionalGoals; // ADDED
  trackingSettings?: TrackingSettings; // ADDED
}

export const TIER_ACCESS: { [key in UserTier]: { [feature: string]: boolean } } = {
    free: { hasChallenges: false, hasChat: false, hasPrograms: false, hasAdFree: false },
    'ad-free': { hasChallenges: false, hasChat: false, hasPrograms: false, hasAdFree: true },
    basic: { hasChallenges: false, hasChat: true, hasPrograms: false, hasAdFree: true },
    premium: { hasChallenges: true, hasChat: true, hasPrograms: true, hasAdFree: true },
    coaching: { hasChallenges: true, hasChat: true, hasPrograms: true, hasAdFree: true },
};

// -----------------------------------------------------------------------------
// CHAT-RELATED TYPES (SINGLE SOURCE OF TRUTH)
// -----------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: any; // Can be a string (ISO) on the client, or a Firestore Timestamp on the server
  isSystemMessage?: boolean;
  fileUrl?: string;
  fileName?: string;
  userId?: string; // DEPRECATED: Prefer senderId
  userName?: string;
}

export interface Chat {
  id: string;
  name: string;
  description: string;
  type: 'coaching' | 'challenge' | 'open' | 'private_group';
  ownerId?: string;
  participants: string[];
  participantCount: number;
  createdAt: any; // Can be a string (ISO) on the client, or a Firestore Timestamp on the server
  lastMessage?: ChatMessage; // This will hold the last message object for display
  unreadCount?: number; // For the notification badge
  thumbnailUrl?: string;
  rules?: string[];
  mutedBy?: string[];
  // Timestamps for internal backend logic, can be strings on the client
  lastClientMessage?: any;
  lastCoachMessage?: any;
  lastAutomatedMessage?: any;
}


// -----------------------------------------------------------------------------
// NUTRITION & FOOD-RELATED TYPES
// -----------------------------------------------------------------------------

export type NovaGroup = 1 | 2 | 3 | 4;

export const PortionSizesSchema = z.object({
  small: z.string().optional(),
  medium: z.string().optional(),
  large: z.string().optional(),
});

export const UpfAnalysisSchema = z.object({
  isUPF: z.boolean(),
  reasoning: z.string(),
  ingredients: z.array(z.string()),
});

export const UpfPercentageSchema = z.object({
  value: z.number(),
  reasoning: z.string(),
});

export const GlutenAnalysisSchema = z.object({
  containsGluten: z.boolean(),
  reasoning: z.string(),
});

export const EnrichedFoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  novaGroup: z.number().optional(),
  portionSizes: PortionSizesSchema.optional(),
  upfAnalysis: UpfAnalysisSchema.optional(),
  upfPercentage: UpfPercentageSchema.optional(),
  glutenAnalysis: GlutenAnalysisSchema.optional(),
});


// -----------------------------------------------------------------------------
// PROGRAMS & CHALLENGES
// -----------------------------------------------------------------------------

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
  content: string;
}
export interface TrackingSettings {
  nutrition?: boolean;
  hydration?: boolean;
  activity?: boolean;
  sleep?: boolean;
  stress?: boolean;
  measurements?: boolean;
  units?: 'imperial' | 'metric';
  reminders?: boolean;
}

export interface Challenge {
    id: string;
    name: string;
    description: string;
    dates: { from: any, to: any };
    maxParticipants: number;
    trackables: any[];
    thumbnailUrl: string;
    participants: string[];
    participantCount: number;
    points?: { [key: string]: number };
    streaks?: { [key: string]: { lastLog: any, count: number } };
    notes?: string;
    type: 'challenge';
    createdAt?: any;
    scheduledPillars?: {
        pillarId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
        notes?: string;
    }[];
    scheduledHabits?: {
        habitId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
    }[];
    customTasks?: {
        description: string;
        startDay: number;
        unit: 'reps' | 'seconds' | 'minutes';
        goalType: 'static' | 'progressive' | 'user-records';
        goal?: number;
        startingGoal?: number;
        increaseBy?: number;
        increaseEvery?: 'week' | '2-weeks' | 'month';
        notes?: string;
    }[];
    progress?: {
        [userId: string]: {
            [date: string]: { // format: yyyy-MM-dd
                [taskDescription: string]: boolean | number;
            }
        }
    }
}


export interface NutritionalGoals {
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    calculationMode: 'ideal' | 'actual' | 'custom';
    calorieModifier: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    calorieGoal?: number;
    calorieGoalRange?: { min: number; max: number; };
    tdee?: number;
}

export interface SearchResult {
    fdcId: number;
    description: string;
    brandOwner?: string;
    isCached?: boolean;
}

export interface HybridFoodSearchResult {
    fdcId: number;
    description: string;
    brandOwner?: string;
    isCached?: boolean;
}
