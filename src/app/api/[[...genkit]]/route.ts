// src/app/api/[[...genkit]]/route.ts
export const runtime = 'nodejs';

import '@/ai/genkit.config';

// import { simpleTestFlow } from '@/ai/flows/simple-test';
import { NextRequest, NextResponse } from 'next/server';

/*
export async function POST(req: NextRequest) {
  try {
    const inputData = await req.json();

    // FINAL CORRECTION: The console.log revealed the method is named 'run', not 'invoke'.
    const result = await simpleTestFlow.run(inputData);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error in POST handler: ${e.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
*/

