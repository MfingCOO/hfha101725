import * as React from 'react';
import { Trophy } from 'lucide-react';

export type TrophyDefinition = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  // A function that returns true if the trophy is earned based on streak data
  isEarned: (data: { bestStreak: number }) => boolean;
};

export const TROPHY_DEFINITIONS: TrophyDefinition[] = [
  {
    id: '3_DAY_STREAK',
    name: 'On Fire!',
    description: 'Maintain a 3-day streak in any task.',
    icon: Trophy,
    isEarned: ({ bestStreak }) => bestStreak >= 3,
  },
  {
    id: '7_DAY_STREAK',
    name: 'Unstoppable',
    description: 'Maintain a 7-day streak in any task.',
    icon: Trophy,
    isEarned: ({ bestStreak }) => bestStreak >= 7,
  },
    {
    id: '14_DAY_STREAK',
    name: 'Relentless',
    description: 'Maintain a 14-day streak in any task.',
    icon: Trophy,
    isEarned: ({ bestStreak }) => bestStreak >= 14,
  },
];

export const getTrophyById = (id: string): TrophyDefinition | undefined => {
  return TROPHY_DEFINITIONS.find(trophy => trophy.id === id);
};
