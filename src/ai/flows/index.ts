import { analyzeSingleFoodFlow } from './nutrition/analyze-single-food';
import { calculateDailySummaries as calculateDailySummariesFlow } from './calculate-daily-summaries';
// import { createClientFlow } from './create-client-flow'; // This flow is known to be broken, keeping it commented out.
import { enrichFoodDetailsFlow } from './nutrition/enrich-food-details-flow';
// import { generateInsightFlow } from './rag/generate-insight'; // File does not exist
import { generatePopulationInsightFlow } from './generate-population-insights'; // Corrected path
// import { processScheduledEventsFlow } from './events/manage-indulgence-plan'; // File does not exist
import { initMenuFlow } from './menu';
import { proactiveCoachingFlow } from './rag/proactive-coach';
// import { searchAndAnalyzeFoodsFlow } from './nutrition/search-and-analyze-foods'; // File does not exist

export const flows = [
  analyzeSingleFoodFlow,
  calculateDailySummariesFlow,
  // createClientFlow,
  enrichFoodDetailsFlow,
  // generateInsightFlow,
  generatePopulationInsightFlow,
  // processScheduledEventsFlow,
  initMenuFlow,
  proactiveCoachingFlow,
  // searchAndAnalyzeFoodsFlow,
];
