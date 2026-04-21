"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Logo } from "@/components/Logo";
import { sendVerificationEmail } from "@/lib/auth-api";
import { useLanguage } from "@/components/LanguageProvider";
import { Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";

type VerifyState = "loading" | "success" | "error";

function VerifyEmailContent() {
  const { tr } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  // Guard against React Strict Mode double-invoking the effect, which would
  // consume the token on the first call and cause the second to always fail.
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setErrorMsg(tr("verifyEmail.noToken"));
      return;
    }

    (async () => {
      // Let NextAuth exchange the token and create a session server-side
      const signInResult = await signIn("credentials", { redirect: false, token });

      if (!signInResult?.ok) {
        setState("error");
        setErrorMsg(signInResult?.error || tr("verifyEmail.linkExpired"));
        return;
      }

      // Poll briefly for the session to appear (NextAuth may need a moment)
      let session = await getSession();
      for (let i = 0; i < 6 && !session?.user; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        session = await getSession();
      }

      if (!session?.user) {
        // Session didn't appear — show success but instruct manual login
        setState("error");
        setErrorMsg(tr("verifyEmail.autoSignInFailed"));
        return;
      }

      setState("success");
      if (session.user?.email) setResendEmail(session.user.email);

      const role = session.user.role || "user";
      const targetRoute = role === "admin" ? "/dashboard/admin" : "/dashboard/user";
      // Redirect immediately now that session is available
      router.replace(targetRoute);
    })();
  }, [searchParams, router]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendStatus("sending");
    await sendVerificationEmail(resendEmail);
    setResendStatus("sent");
  };

  if (state === "loading") {
    return (
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent-cyan mx-auto" />
        <p className="text-sm text-muted-foreground">{tr("verifyEmail.verifying")}</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="text-center space-y-5">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
        <div>
          <h1 className="text-xl font-bold">{tr("verifyEmail.verified")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr("verifyEmail.redirectingToDashboard")}
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/user")}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          {tr("verifyEmail.goToDashboard")} <ArrowRight size={16} />
        </button>
        <p className="text-xs text-muted-foreground">{tr("verifyEmail.redirectingSoon")}</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-5">
      <XCircle className="w-12 h-12 text-red-400 mx-auto" />
      <div>
        <h1 className="text-xl font-bold">{tr("verifyEmail.failed")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
      </div>

      {resendEmail ? (
        <button
          onClick={handleResend}
          disabled={resendStatus !== "idle"}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border/50 hover:bg-background/50 text-sm transition-colors disabled:opacity-60"
        >
          {resendStatus === "sending" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {resendStatus === "idle"
            ? tr("verifyEmail.requestNewEmail")
            : resendStatus === "sending"
            ? tr("login.sending")
            : tr("verifyEmail.newEmailSent")}
        </button>
      ) : (
        <Link href="/signup" className="w-full btn-primary flex items-center justify-center gap-2">
          {tr("verifyEmail.backToSignUp")} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  const { tr } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan to-accent-purple" />
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Suspense
          fallback={
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-accent-cyan mx-auto" />
              <p className="text-sm text-muted-foreground">{tr("common.loading")}</p>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
