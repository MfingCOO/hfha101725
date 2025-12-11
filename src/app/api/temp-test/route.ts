import { NextResponse } from 'next/server';

// This is a standard Next.js API route.
// It is not a Server Action and does not use Genkit directly.
export async function GET(request: Request) {
  // This console.log is the most important part. 
  // If this appears in your terminal, we have a working connection.
  console.log('[API Route] The temporary test endpoint was successfully called.');
  
  // We return a simple JSON response to the browser.
  return NextResponse.json({ message: 'Success! The API route is working.' });
}
