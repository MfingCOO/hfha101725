import { calculateDailySummaries as calculateDailySummariesFlow } from './calculate-daily-summaries';
import { enrichFoodDetailsFlow } from './nutrition/enrich-food-details-flow';
import { generatePopulationInsightFlow } from './generate-population-insights';
import { menuFlow } from './menu'; 

/**
 * This array registers all active Genkit flows.
 * The 'rag' folder and 'proactive-coach' have been removed.
 */
export const flows = [
  calculateDailySummariesFlow,
  enrichFoodDetailsFlow,
  generatePopulationInsightFlow,
  menuFlow,
];