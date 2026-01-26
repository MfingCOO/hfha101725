import { NextResponse } from 'next/server';
import { algoliaAdmin, foodCacheIndex } from '@/lib/algoliaAdmin';

export async function GET(request: Request) {
  // The import above will trigger the console.log in the algoliaAdmin.ts file.
  // The log will appear in the terminal where `npm run dev` is running.
  const message = `The API route is working. foodCacheIndex is currently ${foodCacheIndex}. Check the 'npm run dev' terminal for diagnostic logs.`;
  return NextResponse.json({ message });
}
