
import { NextResponse } from 'next/server';
import { hybridFoodSearch } from './actions';

export async function POST(request: Request) {
  const { query, scope } = await request.json();

  if (typeof query !== 'string' || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await hybridFoodSearch(query, scope);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[API Search Route] Error executing hybrid search:', error);
    return new NextResponse(
      JSON.stringify({ message: 'An internal server error occurred.' }),
      { status: 500 }
    );
  }
}
