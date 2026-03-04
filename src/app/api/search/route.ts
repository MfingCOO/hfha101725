import { NextResponse } from 'next/server';
import { hybridFoodSearch } from './actions';

export async function POST(request: Request) {
  try {
    const { query, scope } = await request.json();

    if (typeof query !== 'string' || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await hybridFoodSearch(query, scope);

    // This is the specific fix for the "Only plain objects" error.
    // It turns those problematic Firestore Timestamps into strings.
    const sanitizedResults = JSON.parse(JSON.stringify(results, (key, value) => {
      if (value && typeof value === 'object' && value._seconds !== undefined) {
        return new Date(value._seconds * 1000).toISOString();
      }
      return value;
    }));

    return NextResponse.json({ results: sanitizedResults });
  } catch (error: any) {
    console.error('[API Search Route] Error executing hybrid search:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred.', error: error.message },
      { status: 500 }
    );
  }
}