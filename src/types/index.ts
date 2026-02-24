
import { z } from "zod";

// Defines the subscription tiers available in the application.
export enum UserTier {
    Free = 'free',
    AdFree = 'ad-free',
    Basic = 'basic',
    Premium = 'premium',
    Coaching = 'coaching',
}

// Using 'as const' makes the array type specific for Zod's .enum() method
export const TIER_ACCESS = [
    'free',
    'ad-free',
    'basic',
    'premium',
    'coaching'
] as const;


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

// Correctly defines the DailySummary object.
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
    avgUpf: number;
    avgNutrients?: {
        Energy?: number;
        Protein?: number;
        'Total lipid (fat)'?: number;
        'Carbohydrate, by difference'?: number;
    };
}

// **THE FIX**: UserProfile has been removed and all properties are consolidated into ClientProfile.
// This is now the single source of truth for all user/client data.
export interface ClientProfile {
    uid: string;
    fullName: string;
    email: string;
    photoURL?: string;
    tier: UserTier;
    chatIds?: string[];
    coachId?: string;
    challengeIds?: string[];
    activeProgramId?: string; 
    stripeCustomerId?: string | null;
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
}

// CORRECTED: Restoring CreateClientInput to its full, correct definition where all fields are required.
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
    type: 'open' | 'private_group' | 'coaching';
    participants: string[];
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
}

export interface SearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  foodCategory?: string;
  ingredients?: string;
}

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
export const PortionSizesSchema = z.array(PortionSizeSchema);
export type PortionSize = z.infer<typeof PortionSizeSchema>;

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
    portionSizes: PortionSizesSchema,
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    status: z.string().optional(),
    createdBy: z.string().optional(),
});
export type EnrichedFood = z.infer<typeof EnrichedFoodSchema>;

export interface Portion extends PortionSize {}

export const MealItemSchema = EnrichedFoodSchema.extend({
    quantity: z.number(),
    unit: z.string(),
    calories: z.number(),
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

export interface RecentFood extends EnrichedFood {
    lastLogged: any;
}

export interface IndexedKnowledgeChunk {
    sourceDocumentId: string;
    coachId: string;
    textChunk: string;
    embedding: number[];
}
export interface AvailabilityBlock {
    start: any;
    end: any;
    [key: string]: any;
  }
  
  export interface AvailabilitySettings {
    vacationBlocks: AvailabilityBlock[];
    [key: string]: any;
  }
  
  export interface SiteSettings {
    videoCallLink?: string;
    availability?: AvailabilitySettings;
  }
  
export interface Popups {
    id?: string;
    coachId: string;
    message: string;
    targetType: 'all' | 'tier' | 'multiple' | 'single';
    targetValue: string | string[] | null;
    scheduledAt: string;
    createdAt: string;

    imageUrl?: string;
    hyperlink?: string;
    status: 'scheduled' | 'sent' | 'cancelled';
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

export interface HybridFoodSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
  isCached: boolean;
}

export const HybridFoodSearchResultSchema = z.array(z.object({
    fdcId: z.number(),
    description: z.string(),
    brandOwner: z.string().optional(),
    isCached: z.boolean(),
}));
