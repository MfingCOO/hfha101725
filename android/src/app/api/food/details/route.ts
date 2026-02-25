
import { NextResponse } from 'next/server';

// This is the new, centralized function for fetching food details.
async function getFoodDetailsFromUSDA(fdcId: number) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    throw new Error('USDA API key is not configured.');
  }

  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`;
  console.log(`[Food Details API] Fetching from: ${url}`)

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[Food Details API] USDA API request failed with status: ${response.status}`)
    throw new Error(`USDA API request failed with status: ${response.status}`);
  }

  const data = await response.json();

  // Standardize the output to match our application's data model.
  return {
    fdcId: data.fdcId,
    description: data.description,
    ingredients: data.ingredients || ''
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fdcId } = body;

    if (!fdcId) {
      return new NextResponse(JSON.stringify({ message: 'fdcId is required' }), { status: 400 });
    }

    console.log(`[Food Details API] Received request for fdcId: ${fdcId}`)
    const foodDetails = await getFoodDetailsFromUSDA(fdcId);
    return NextResponse.json(foodDetails);

  } catch (error: any) {
    console.error('[Food Details API] An error occurred:', error);
    return new NextResponse(
      JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
      { status: 500 }
    );
  }
}
