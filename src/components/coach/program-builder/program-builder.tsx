'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProgramBuilder() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Program Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center text-muted-foreground py-10">
            <p>Coming soon!</p>
            <p className="text-sm">This is where you will create and manage multi-week workout programs.</p>
        </div>
      </CardContent>
    </Card>
  );
}
