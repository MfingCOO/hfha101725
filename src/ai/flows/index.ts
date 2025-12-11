import { analyzeSingleFoodFlow } from './nutrition/analyze-single-food';
import { automatedClientNudge } from './automated-client-nudge';
import { calculateDailySummariesFlow } from './calculate-daily-summaries';
import { createClientFlow } from './create-client-flow';
import { enrichFoodDetailsFlow } from './nutrition/enrich-food-details-flow';
import { generateInsightFlow } from './generate-insight-flow';
import { generatePopulationInsightFlow } from './generate-population-insights';
import { processScheduledEventsFlow } from './manage-indulgence-plan-flow';
import { initMenuFlow } from './menu';
import { proactiveCoachingFlow } from './rag/proactive-coach';
import { searchAndAnalyzeFoodsFlow } from './nutrition/search-and-analyze-foods';

export const flows = [
  analyzeSingleFoodFlow,
  automatedClientNudge,
  calculateDailySummariesFlow,
  createClientFlow,
  enrichFoodDetailsFlow,
  generateInsightFlow,
  generatePopulationInsightFlow,
  processScheduledEventsFlow,
  initMenuFlow,
  proactiveCoachingFlow,
  searchAndAnalyzeFoodsFlow,
];
