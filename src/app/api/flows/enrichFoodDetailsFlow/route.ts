'use server';

import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';
import { NextRequest, NextResponse } from 'next/server';

// This is the new API route that makes the Genkit flow available over HTTP.
export async function POST(req: NextRequest) {
  const { input } = await req.json();

  if (!input) {
    return NextResponse.json({ error: 'Input data is missing' }, { status: 400 });
  }

  try {
    const output = await enrichFoodDetailsFlow.run(input);
    // CORRECTED: Return the output directly, not wrapped in an object.
    return NextResponse.json(output);
  } catch (error) {
    console.error('Error running enrichFoodDetailsFlow:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process food details', details: errorMessage }, { status: 500 });
  }
}
