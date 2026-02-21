
import { NextResponse } from 'next/server';
import { createUserNotification } from '@/services/reminders';
import { Timestamp } from 'firebase-admin/firestore';

// This is a temporary test route to verify appointment reminders.
// To use, deploy this code and visit /api/test-reminder in your browser.

export async function GET() {
  const testUserId = 'NyluiXScIxP6boK4SNFkvzarwt2'; // The user ID you provided
  const fakeAppointmentId = 'fake-appointment-id-123';

  console.log(`[Test Route] Attempting to send reminder to user: ${testUserId}`);

  try {
    await createUserNotification(testUserId, {
      type: 'appointment_reminder',
      title: 'Test Appointment',
      message: 'This is a test reminder. Tap to open the event.',
      pillarId: 'calendar',
      entityId: fakeAppointmentId,
      deliverAt: Timestamp.now(), // Send immediately
    });

    console.log(`[Test Route] Successfully triggered notification for user: ${testUserId}`);
    return NextResponse.json({
      message: `Test notification sent to user ${testUserId}. Check your device.`,
    });

  } catch (error: any) {
    console.error('[Test Route] Error sending test notification:', error);
    return new NextResponse(
      JSON.stringify({ message: 'Internal Server Error', error: error.message }),
      { status: 500 }
    );
  }
}
