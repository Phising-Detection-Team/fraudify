"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      setError(oauthError);
      return;
    }
    // If we land here without an error, the backend already redirected us to
    // /dashboard. This page is only shown when the backend bounces back with
    // an error query param (e.g. /auth/callback?oauth_error=access_denied).
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass-panel w-full max-w-sm p-8 rounded-2xl text-center space-y-6">
          <Logo className="mx-auto" />
          <h1 className="text-xl font-bold">Connection Failed</h1>
          <p className="text-sm text-muted-foreground">
            Could not connect your mailbox.{" "}
            <span className="font-mono text-xs bg-background/50 px-1 rounded">{error}</span>
          </p>
          <button
            onClick={() => router.push("/signup")}
            className="w-full btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm p-8 rounded-2xl text-center space-y-6">
        <Logo className="mx-auto" />
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-cyan" />
        <p className="text-sm text-muted-foreground">Connecting your mailbox…</p>
      </div>
    </div>
  );
}