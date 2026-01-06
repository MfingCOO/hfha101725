import { NextResponse } from 'next/server';
import { processScheduledEventsFlow } from '@/ai/flows/manage-indulgence-plan-flow';

/**
 * This route provides an endpoint that can be called to trigger the event processing flow.
 * In production, this is called by a cron job service (e.g., Google Cloud Scheduler).
 * In development, this is called by a client-side interval in the main layout file.
 */
export async function GET() {
  console.log("CRON API: Route handler started.");
  try {
    const result = await processScheduledEventsFlow();
    console.log("CRON API: Flow completed successfully.");
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("CRON API: An error occurred in the scheduler endpoint.", error);

    // Return the full error details in the response for robust debugging.
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal Server Error in cron job. See 'error' property for details.",
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }, 
      { status: 500 }
    );
  }
}

// Ensure this route is always run dynamically and not cached.
export const dynamic = 'force-dynamic';
