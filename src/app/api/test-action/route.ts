// This is a temporary, secret API route to test the postMessageAction
// using the application's own, working Firebase connection.

import { postMessageAction } from "../../chats/actions"; // CORRECTED PATH
import { NextResponse } from "next/server";

export async function POST() {
  console.log("[API_TEST_ROUTE] Test triggered.");

  // This is the same test data we used before.
  const testInput = {
    chatId: 'Yq61qJwt4GJ2HZk4QtYV', // CORRECTED, CASE-SENSITIVE ID
    text: '[INTERNAL TEST] This is a test message from the internal API route.',
    userId: 'NyluiXScIxP6boK4SNFkvzarwtg1',
    userName: 'Internal Diagnostic',
  };

  console.log("[API_TEST_ROUTE] Calling postMessageAction with:", testInput);

  try {
    const result = await postMessageAction(testInput);
    console.log("[API_TEST_ROUTE] postMessageAction completed.", result);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[API_TEST_ROUTE] An error occurred while running the action:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
