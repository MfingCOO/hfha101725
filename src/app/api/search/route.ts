
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// SURGICAL CHANGE: Added 'brandName' to the interface for more accurate sorting.
interface UsdaFoodItem { fdcId: number; description: string; brandOwner?: string; brandName?: string; ingredients?: string; dataType?: string; }
interface UsdaApiResponse { foods: UsdaFoodItem[]; }

// SURGICAL CHANGE: Injected the relevance scoring function.
function calculateRelevance(food: UsdaFoodItem, queryLower: string): number {
    const descriptionLower = food.description.toLowerCase();
    const brandOwnerLower = (food.brandOwner || '').toLowerCase();
    const brandNameLower = (food.brandName || '').toLowerCase();
    let relevanceScore = 0;

    // Primary bonus for brand match
    if (brandOwnerLower.includes(queryLower) || brandNameLower.includes(queryLower)) {
        relevanceScore += 10000;
    }

    // Secondary bonus for description match
    if (descriptionLower.startsWith(queryLower)) {
        relevanceScore += 1000;
    } else if (descriptionLower.includes(queryLower)) {
        relevanceScore += 500;
    }

    // Penalty for long descriptions
    relevanceScore -= descriptionLower.length * 0.1;

    return relevanceScore;
}

async function searchUSDA(query: string) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error('[API Search Route] CRITICAL: USDA_API_KEY not found.');
    return { error: 'SERVER_NOT_READY', message: 'API key is not available.' };
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageSize: 50, dataType: ['Branded', 'Foundation', 'SR Legacy'] }),
    });

    if (!response.ok) {
      console.error(`[API Search Route] USDA API returned a non-OK status: ${response.status}.`);
      return { results: [] };
    }

    const data: UsdaApiResponse = await response.json();

    if (!data.foods || !Array.isArray(data.foods)) {
      return { results: [] };
    }

    const queryLower = query.toLowerCase();
    
    const sortedFoods = data.foods
      .map(food => ({
        ...food,
        relevanceScore: calculateRelevance(food, queryLower),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(f => ({ fdcId: f.fdcId, description: f.description, brandOwner: f.brandOwner, ingredients: f.ingredients }));

    return { results: sortedFoods };

  } catch (error) {
    console.error('[API Search Route] An error occurred during the USDA search operation:', error);
    return { results: [] };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return new NextResponse(JSON.stringify({ message: 'Search query is required.' }), { status: 400 });
    }

    const searchResults = await searchUSDA(query);

    if (searchResults.error === 'SERVER_NOT_READY') {
      return new NextResponse(
        JSON.stringify({ message: 'Server is warming up. Please try again in a moment.' }),
        { status: 503 }
      );
    }

    return NextResponse.json(searchResults);

  } catch (error: any) {
    console.error('[API Search Route] A truly unhandled error occurred:', error);
    return new NextResponse(
      JSON.stringify({ message: error.message || 'An internal server error occurred.' }), 
      { status: 500 }
    );
  }
}
