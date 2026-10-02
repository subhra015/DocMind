"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabaseBrowser } from "@/lib/supabase/client";
import { signOut } from "@/server/actions/auth";

export default function SettingsPage() {
  const [email, setEmail] = useState<string>("–");
  const [userId, setUserId] = useState<string>("–");

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) {
          setEmail(data.user.email ?? "–");
          setUserId(data.user.id.substring(0, 8) + "…");
        }
      });
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Your account details and options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">User ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {userId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            All documents and data are protected by Row-Level Security. Your
            files are stored in a private bucket accessible only through
            signed URLs.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="destructive" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}