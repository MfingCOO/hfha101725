import { z } from "zod";

// --- SUBSCRIPTION TIERS ---
// Union Type for type-checking
export type UserTier = 
  | 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching' 
  | 'Free' | 'AdFree' | 'Basic' | 'Premium' | 'Coaching';

// Constant Object for value-access (e.g., UserTier.Free)
export const UserTier = {
    Free: 'free' as UserTier,
    AdFree: 'ad-free' as UserTier,
    Basic: 'basic' as UserTier,
    Premium: 'premium' as UserTier,
    Coaching: 'coaching' as UserTier,
    free: 'free' as UserTier,
    'ad-free': 'ad-free' as UserTier,
    basic: 'basic' as UserTier,
    premium: 'premium' as UserTier,
    coaching: 'coaching' as UserTier,
} as const;

export const TIER_ACCESS = [
    'free',
    'ad-free',
    'basic',
    'premium',
    'coaching'
] as const;

// --- GLOBAL COMPATIBILITY ALIASES ---
export type UserProfile = ClientProfile; 

// --- NUTRITION & SEARCH TYPES ---
export interface HybridFoodSearchResult {
    fdcId: number;
    description: string;
    brandOwner?: string;
    score?: number;
    source: 'USDA' | 'LOCAL' | 'AI_ANALYSIS';
    isCached?: boolean;
}
export type SearchResult = HybridFoodSearchResult;

// --- SETTINGS TYPES ---
export interface AvailabilitySettings {
    timezone?: string; 
    vacationBlocks?: { from: any; to: any }[];
    weekly: { day: string; enabled: boolean; slots: string[] }[]; 
    monday?: { enabled: boolean; slots: string[] };
    tuesday?: { enabled: boolean; slots: string[] };
    wednesday?: { enabled: boolean; slots: string[] };
    thursday?: { enabled: boolean; slots: string[] };
    friday?: { enabled: boolean; slots: string[] };
    saturday?: { enabled: boolean; slots: string[] };
    sunday?: { enabled: boolean; slots: string[] };
}

export interface SiteSettings {
    appName: string;
    contactEmail: string;
    maintenanceMode: boolean;
    videoCallLink?: string;
    availability?: AvailabilitySettings;
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

export interface DailySummary {
    lastUpdated: any;
    unit: 'kg' | 'lbs';
    startWeight: number | null;
    currentWeight: number | null;
    lastWeightDate: string | null;
    startWthr: number | null;
    currentWthr: number | null;
    lastWaistDate: string | null;
    avgSleep: number;
    avgActivity: number;
    avgHydration: number;
    cravings: number;
    binges: number;
    stressEvents: number;
    stressReliefs?: number;
    avgUpf: number;
    dob?: string | null;
    sex?: 'male' | 'female' | 'unspecified' | null;
    currentWthr_val?: number; 
    avgNutrients?: {
        Energy?: number;
        Protein?: number;
        'Total lipid (fat)'?: number;
        'Carbohydrate, by difference'?: number;
    };
}

export interface ClientProfile {
    uid: string;
    fullName: string;
    email: string;
    photoURL?: string;
    tier: UserTier;
    role?: 'client' | 'coach';
    status?: 'active' | 'pending_payment' | 'archived';
    chatIds?: string[];
    coachId?: string;
    challengeIds?: string[];
    activeProgramId?: string; 
    createdAt?: any;
    suggestedGoals?: NutritionalGoals;
    height?: {
        value: number;
        unit: 'in' | 'cm';
    };
    goals?: {
        weightGoal?: number;
        wthrGoal?: number;
    };
    lastBinge?: any;
    bingeFreeSince?: any;
    lastInteraction?: any; 
    lastStreakNotification?: any;
    achievedStreakMilestones?: number[];
    dailySummaries?: { [date: string]: DailySummary };
    dailySummary?: DailySummary; 
    hydrationSettings?: {
        target: number;
        unit: 'oz' | 'ml';
        remindersEnabled?: boolean;
        reminderTimes?: string[];
    };
    rda?: {
        [key: string]: number | null;
    };
    wthr?: number;
    onboarding?: any;
    customGoals?: NutritionalGoals;
    trackingSettings?: TrackingSettings;
    tdee?: number;
    calorieGoal?: number;
    calorieGoalRange?: { min: number; max: number; };
    averageWakeUpTime?: string;
    bedtime?: string;
    fcmTokens?: string[];
    dismissedPopupIds?: string[];
    idealBodyWeight?: number; 
    hasLoggedInBefore?: boolean; 
    hasHadCoachingChat?: boolean;
    timezone?: string; 
    timezoneOffset?: number; 
    unitSystem?: 'metric' | 'imperial'; 
    pushToken?: string;
    dob?: string | null;
    sex?: 'male' | 'female' | 'unspecified' | null;
    remindersEnabled?: boolean;
    preferences?: { adsEnabled?: boolean };
    revenueCatLastEvent?: string;
    revenueCatEntitlements?: any;
    lastActivity?: any;
}

export type CreateClientInput = {
    email: string;
    password: string;
    fullName: string;
    tier: (typeof TIER_ACCESS)[number];
    birthdate: string;
    sex: 'male' | 'female' | 'unspecified';
    units: 'imperial' | 'metric';
    height: number;
    weight: number;
    waist: number;
    zipCode: string;
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
    wakeTime: string;
    sleepTime: string;
    coachId: string; 
};

// --- CHAT & MESSAGING ---
export interface CoachNote {
    id: string;
    clientId: string;
    coachId: string;
    coachName: string; 
    text: string;
    createdAt: any; 
    updatedAt?: any;
}

export interface Chat {
    id: string;
    name: string;
    description: string;
    type: 'open' | 'private_group' | 'coaching' | 'challenge';
    participants: (string | ClientProfile)[];
    participantCount: number;
    ownerId: string;
    createdAt: any; 
    rules?: string[];
    lastMessage?: ChatMessage;
    lastMessageSenderId?: string;
    lastAutomatedMessage?: any;
    lastCoachMessage?: any; 
    lastClientMessage?: any;
    mutedBy?: string[];
    lastClientMessageTimestamp?: any;
    isCoachingChat?: boolean;
    lastActivity?: any;
    unreadCount?: number;
    coachingToolsEnabled?: boolean;
}

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    timestamp: any; 
    isSystemMessage: boolean;
    text?: string;
    fileUrl?: string;
    fileName?: string;
    senderId?: string; 
    reactions?: { [emoji: string]: string[] };
}

// --- CALENDAR & LOGGING ---
// CORRECTED: Added the missing interfaces
export interface CoachLike {
    coachId: string;
    timestamp: any;
}

export interface CoachEntryNote {
    coachId: string;
    coachName: string;
    text: string;
    timestamp: any;
}

export interface LogEntry {
    id: string;
    uid: string;
    pillar: string;
    entryDate: any;
    createdAt: any;
    [key: string]: any; 
    coachLike?: CoachLike;
    coachNote?: CoachEntryNote;
}

// --- POPUPS & EVENTS ---
export interface Popups {
    id: string;
    coachId: string;
    message: string;
    targetType: 'all' | 'tier' | 'multiple' | 'single';
    targetValue: string | string[] | null;
    scheduledAt: string;
    createdAt: string;
    imageUrl?: string;
    hyperlink?: string;
    status: 'scheduled' | 'sent' | 'cancelled';
    title?: string;
    name?: string;
}
export type Popup = Popups;

export interface SerializablePopup extends Popups {
    title: string;
    name: string;
}

export interface LiveEvent {
    id: string;
    title: string;
    description: string;
    coachId: string;
    eventTimestamp: any;
    entryDate: any;
    durationMinutes: number;
    videoConferenceLink?: string;
    signUpDeadline: any;
    attendees: string[];
    createdAt: any;
}

// --- CHALLENGES ---
export interface Challenge {
    id: string;
    name: string; 
    description: string;
    type: 'habit' | 'weight' | 'community';
    participants: string[];
    participantCount: number;
    maxParticipants?: number;
    thumbnailUrl?: string;
    dates: {
        from: any; 
        to: any;
    };
    tasks: {
        id: string;
        description: string;
        type: 'boolean' | 'numeric';
        goalValue?: number;
    }[];
    scheduledPillars?: any[];
    customTasks?: any[];
    scheduledHabits?: any[];
    imageUrl?: string;
    rules?: string[];
    createdAt: any;
    createdBy: string;
    progress?: Record<string, any>;
}

// --- HABITS ---
export interface Habit {
    id: string;
    name: string; 
    description: string;
    icon?: string;
    category?: string;
    frequency: 'daily' | 'weekly' | 'custom';
    createdAt: any;
    updatedAt?: any;
}

export interface CustomHabit extends Habit {
    coachId: string;
    isGlobal?: boolean; 
}

// --- ZOD SCHEMAS ---
export enum NovaGroup {
    WHOLE_FOOD = "whole_food",
    PROCESSED = "processed",
    UPF = "UPF",
    UNCLASSIFIED = "UNCLASSIFIED",
    UNPROCESSED_OR_MINIMALLY_PROCESSED = "UNPROCESSED_OR_MINIMALLY_PROCESSED",
    PROCESSED_CULINARY_INGREDIENTS = "PROCESSED_CULINARY_INGREDIENTS",
}

export const UpfAnalysisSchema = z.object({
    rating: z.nativeEnum(NovaGroup),
    justification: z.string(),
});
export type UpfAnalysis = z.infer<typeof UpfAnalysisSchema>;

export const GlutenAnalysisSchema = z.object({
    isGlutenFree: z.boolean(),
    justification: z.string(),
});
export type GlutenAnalysis = z.infer<typeof GlutenAnalysisSchema>;

export const UpfPercentageSchema = z.object({
    value: z.number(),
    justification: z.string(),
});
export type UpfPercentage = z.infer<typeof UpfPercentageSchema>;

export const PortionSizeSchema = z.object({
    description: z.string(),
    gramWeight: z.number(),
});
export type PortionSize = z.infer<typeof PortionSizeSchema>;
export type Portion = PortionSize;

export const NutrientSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    amount: z.number(),
    unitName: z.string(),
});
export type Nutrient = z.infer<typeof NutrientSchema>;

export const EnrichedFoodSchema = z.object({
    fdcId: z.number(),
    description: z.string(),
    brandOwner: z.string().optional(),
    ingredients: z.string().optional(),
    nutrients: z.array(NutrientSchema),
    source: z.enum(['AI_ANALYSIS', 'USER_PROVIDED', 'MANUAL_BULK']),
    analysisDate: z.string(),
    upfAnalysis: UpfAnalysisSchema,
    glutenAnalysis: GlutenAnalysisSchema.optional(),
    upfPercentage: UpfPercentageSchema,
    portionSizes: z.array(PortionSizeSchema),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    status: z.string().optional(),
    createdBy: z.string().optional(),
});
export type EnrichedFood = z.infer<typeof EnrichedFoodSchema>;

export const MealItemSchema = EnrichedFoodSchema.extend({
    quantity: z.number(),
    unit: z.string(),
    calories: z.number(),
    notes: z.string().optional(),
});
export type MealItem = z.infer<typeof MealItemSchema>;

export interface SavedMeal {
    id: string;
    uid: string;
    name: string;
    items: MealItem[];
    totalCalories: number;
    createdAt: any;
}
export interface InAppMessage {
    title: string;
    message: string;
    chatName?: string;
    // add any other fields you use for notifications
  }
