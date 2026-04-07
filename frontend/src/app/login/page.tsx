"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { config } from "@/lib/config";
import { checkLoginStatus, sendVerificationEmail } from "@/lib/auth-api";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, LogIn, AlertCircle, Eye, EyeOff, Clock, MailCheck, Loader2, Check } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Unverified email state
  const [unverifiedEmail, setUnverifiedEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const targetRoute = session.user.role === "admin" ? config.ROUTES.DASHBOARD_ADMIN : config.ROUTES.DASHBOARD_USER;
      router.push(targetRoute);
    }
  }, [status, session, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnverifiedEmail(false);

    // Check the backend directly first to detect specific errors (e.g. unverified email)
    const loginStatus = await checkLoginStatus(email, password);

    if (!loginStatus.ok) {
      if (loginStatus.status === 403 && loginStatus.error === "Email not verified") {
        setUnverifiedEmail(true);
      } else if (loginStatus.status === 401) {
        setError("Wrong email or password");
      } else {
        setError(loginStatus.error || "Login failed. Please try again.");
      }
      setLoading(false);
      return;
    }

    // Credentials are valid — proceed with NextAuth signIn to establish the session
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error || !result?.ok) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const isDemoAdmin = email === config.DEMO_ACCOUNTS.ADMIN.email;
    const isDemoUser = email === config.DEMO_ACCOUNTS.USER.email;
    localStorage.setItem(config.STORAGE_KEYS.IS_DEMO, (isDemoAdmin || isDemoUser) ? "true" : "false");

    const roleFromStatus = loginStatus.user?.roles?.includes('admin') ? 'admin' : 'user';
    const targetRoute = roleFromStatus === 'admin' ? config.ROUTES.DASHBOARD_ADMIN : config.ROUTES.DASHBOARD_USER;

    setLoading(false);
    router.replace(targetRoute);
  };

  const handleResendVerification = async () => {
    setResendStatus("sending");
    await sendVerificationEmail(email);
    setResendStatus("sent");
    setTimeout(() => setResendStatus("idle"), 5000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel w-full max-w-md p-8 rounded-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan to-accent-purple" />

        <div className="flex flex-col items-center mb-8">
          <Logo className="mb-6 scale-110" />
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your Sentra platform</p>
        </div>

        {sessionExpired && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm p-3 rounded-lg flex items-center gap-2">
            <Clock size={16} className="flex-shrink-0" />
            Your session has expired. Please sign in again.
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-6">
          {/* Generic error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Unverified email banner */}
          {unverifiedEmail && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <MailCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Email not verified</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Please verify your email address before logging in.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus !== "idle"}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors text-xs font-medium text-amber-300 disabled:opacity-60"
              >
                {resendStatus === "sending" && <Loader2 size={12} className="animate-spin" />}
                {resendStatus === "sent" && <Check size={12} />}
                {resendStatus === "idle" ? "Resend verification email" : resendStatus === "sending" ? "Sending…" : "Email sent! Check your inbox."}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email Address / Username</label>
            <input
              id="email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="text-right">
              <Link href="/forgot-password" passHref>
                <p className="text-sm text-accent-cyan hover:underline">Forgot Password?</p>
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-neon bg-foreground text-background font-semibold py-3 rounded-lg flex justify-center items-center gap-2 mt-4"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-background border-t-transparent rounded-full" />
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent-cyan hover:text-accent-cyan/80 transition-colors">
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center border-t border-border/50 pt-6">
          <Link
            href="/extension"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-accent-cyan transition-colors inline-flex items-center gap-2"
          >
            <ShieldCheck size={16} />
            View Browser Extension Preview →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
