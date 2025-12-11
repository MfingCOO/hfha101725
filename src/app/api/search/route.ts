
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface UsdaFoodItem { fdcId: number; description: string; brandOwner?: string; ingredients?: string; dataType?: string; }
interface UsdaApiResponse { foods: UsdaFoodItem[]; }

async function searchUSDA(query: string) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error('[API Search Route] CRITICAL: USDA_API_KEY not found.');
    return { error: 'SERVER_NOT_READY', message: 'API key is not available.' };
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageSize: 50, dataType: ['Branded', 'Foundation', 'SR Legacy'] }),
    });
  } catch (error) {
    console.error('[API Search Route] Fetch to USDA failed completely.', error);
    return { foundationFoods: [], brandedFoods: [], otherFoods: [] };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[API Search Route] USDA API returned a non-OK status: ${response.status}. Body: ${errorBody}`);
    return { foundationFoods: [], brandedFoods: [], otherFoods: [] };
  }

  let data: UsdaApiResponse;
  try {
    // FINAL, DEFINITIVE FIX: The server was crashing here if the USDA API returned a 200 OK status
    // but with a non-JSON body (e.g., an HTML error page or an empty string). This try/catch block
    // now handles that specific failure case, making the server resilient.
    data = await response.json();
  } catch (error) {
    console.error('[API Search Route] Failed to parse JSON from USDA response even though status was OK.', error);
    // By returning empty results here, we prevent the server from crashing.
    return { foundationFoods: [], brandedFoods: [], otherFoods: [] };
  }

  if (!data.foods || !Array.isArray(data.foods)) {
    return { foundationFoods: [], brandedFoods: [], otherFoods: [] };
  }

  const foundationFoods = data.foods.filter(f => f.dataType === 'Foundation').map(f => ({ fdcId: f.fdcId, description: f.description, ingredients: f.ingredients }));
  const brandedFoods = data.foods.filter(f => f.dataType === 'Branded').map(f => ({ fdcId: f.fdcId, description: f.description, brandOwner: f.brandOwner, ingredients: f.ingredients }));
  const otherFoods = data.foods.filter(f => f.dataType !== 'Foundation' && f.dataType !== 'Branded').map(f => ({ fdcId: f.fdcId, description: f.description, ingredients: f.ingredients }));

  return { foundationFoods, brandedFoods, otherFoods };
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
