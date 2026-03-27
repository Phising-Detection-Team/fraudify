"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You declined access. Please try again.",
  server_error: "The authorization server encountered an error.",
  temporarily_unavailable: "The service is temporarily unavailable.",
  invalid_request: "The request was invalid. Please try again.",
};

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      setError(OAUTH_ERROR_MESSAGES[oauthError] ?? "An unexpected error occurred. Please try again.");
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
            Could not connect your mailbox. {error}
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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm p-8 rounded-2xl text-center space-y-6">
            <Logo className="mx-auto" />
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-cyan" />
            <p className="text-sm text-muted-foreground">Connecting your mailbox…</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}