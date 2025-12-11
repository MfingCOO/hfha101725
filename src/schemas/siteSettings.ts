// src/schemas/siteSettings.ts
import { z } from 'zod';

// Defines the Zod schema for site settings validation.
export const siteSettingsSchema = z.object({
  url: z.string().optional(),
  videoCallLink: z.string().optional(),
  aiModelSettings: z.object({
      pro: z.string().optional(),
      flash: z.string().optional(),
  }).optional(),
  availability: z.any().optional(), // Using z.any() for now, can be refined.
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
