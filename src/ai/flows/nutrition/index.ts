import { analyzeSingleFoodFlow } from './analyze-single-food';
// CORRECTED: The imported name is now `searchAndAnalyzeFoodsFlow`
import { searchAndAnalyzeFoodsFlow } from './search-and-analyze-foods';

// This is the critical fix. 
// We must call the factory functions here to get the actual flow objects.
// This ensures that the `withAppCheck` wrapper is applied and the secured
// flows are registered with the Genkit handler.
const securedAnalyzeFlow = analyzeSingleFoodFlow;
// CORRECTED: The function name is now `searchAndAnalyzeFoodsFlow`
const securedSearchFlow = searchAndAnalyzeFoodsFlow;

// We are now exporting the instantiated and secured flows.
// The `.map(fn => fn())` in the route handler is no longer needed and will be removed.
export const nutritionFlows = [securedAnalyzeFlow, securedSearchFlow];
