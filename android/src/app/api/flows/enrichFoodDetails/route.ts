// src/app/api/flows/enrichFoodDetails/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[API Route: enrichFoodDetails] Received request with body:', body);

    // CORRECTED: A flow defined with defineFlow is directly callable.
    // The '.invoke' method was incorrect and has been removed.
    const result = await enrichFoodDetailsFlow(body);

    console.log('[API Route: enrichFoodDetails] Flow invocation successful, returning result:', result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Route: enrichFoodDetails] Error in POST handler:', error);
    // Forward the specific error message from the flow if available
    const errorMessage = error.cause?.message || error.message || 'An unexpected error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
