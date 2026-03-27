"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { config } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
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

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error || !result?.ok) {
      setError("Wrong email or password");
      setLoading(false);
    } else {
      const isDemoAdmin = email === config.DEMO_ACCOUNTS.ADMIN.email;
      const isDemoUser = email === config.DEMO_ACCOUNTS.USER.email;
      const isDemo = isDemoAdmin || isDemoUser;

      localStorage.setItem(config.STORAGE_KEYS.IS_DEMO, isDemo ? "true" : "false");

      const res = await fetch("/api/auth/session");
      const sessionData = await res.json();

      const role = sessionData?.user?.role || "user";
      const targetRoute = role === "admin" ? config.ROUTES.DASHBOARD_ADMIN : config.ROUTES.DASHBOARD_USER;

      setLoading(false);
      setTimeout(() => {
        router.replace(targetRoute);
      }, 200);
    }
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

        <form onSubmit={handleSignIn} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
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
