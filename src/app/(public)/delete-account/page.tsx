'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DeleteAccountPage() {
  return (
    <main className="container mx-auto flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Account and Data Deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We are sorry to see you go. To request the deletion of your account and all associated data, please follow the instructions below.
          </p>
          <div className="space-y-2">
            <p className="font-semibold">Instructions:</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Compose an email from the email address associated with your account.</li>
              <li>Send the email to <a href="mailto:support@yourappdomain.com" className="text-primary underline">support@yourappdomain.com</a>.</li>
              <li>Use the subject line: "Account Deletion Request".</li>
              <li>In the body of the email, please state that you wish to permanently delete your account.</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground pt-4">
            Please note: Account deletion is permanent and cannot be reversed. Once your account is deleted, all of your data, including workout history, chats, and personal information, will be permanently removed from our systems. This process may take up to 30 days to complete.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
