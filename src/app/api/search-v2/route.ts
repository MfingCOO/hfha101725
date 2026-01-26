
import { NextResponse } from 'next/server';
import { foodCacheIndex } from '@/lib/algoliaAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || query.length < 2) {
      return new NextResponse(JSON.stringify({ message: 'Search query must be at least 2 characters.' }), { status: 400 });
    }

    const { hits } = await foodCacheIndex.search(query);

    return NextResponse.json({ results: hits });

  } catch (error: any) {
    console.error('[API Search V2 Route] An error occurred:', error);
    return new NextResponse(
      JSON.stringify({ message: error.message || 'An internal server error occurred.' }),
      { status: 500 }
    );
  }
}
