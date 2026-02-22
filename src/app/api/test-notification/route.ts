
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// This function will handle GET requests to /api/test-notification
export async function GET() {
  const RECIPIENT_ID = 'NyluiXScIxP6boK4SNFkvzarwtg1';

  console.log(`[API Test] Attempting to create a test notification for user: ${RECIPIENT_ID}`);

  const notificationData = {
    userId: RECIPIENT_ID,
    title: 'DIAGNOSTIC TEST',
    message: 'If you see this, the notification engine is working.',
    ctaUrl: '/',
    notificationType: 'test',
    entityId: `test-${Date.now()}`,
    sendTime: Timestamp.now(),
    processed: false,
    processed_at: null,
    error: null,
  };

  try {
    const docRef = await db.collection('notifications').add(notificationData);
    console.log(`[API Test] SUCCESS: Test notification document created. ID: ${docRef.id}`);
    return NextResponse.json({
      status: 'success',
      message: 'Test notification created in Firestore successfully.',
      docId: docRef.id,
      details: 'The backend notification engine should now process this and send a push notification within 60 seconds.'
    });
  } catch (error) {
    console.error('[API Test] ERROR: Failed to create test notification document in Firestore.', error);
    return new NextResponse(
      JSON.stringify({ status: 'error', message: 'Failed to create notification document in Firestore.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
