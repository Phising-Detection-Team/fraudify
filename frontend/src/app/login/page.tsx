"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }

      localStorage.removeItem("is-demo");
      localStorage.setItem("sentra-role", data.user?.role || data.role || "user");
      localStorage.setItem("sentra-access-token", data.access_token || "");
      localStorage.setItem("sentra-refresh-token", data.refresh_token || "");
      const role = data.user?.role || data.role || "user";
      router.push(role === "admin" ? "/dashboard/admin" : "/dashboard/user");
    } catch {
      setError("Unable to connect to the server. Please try again.");
      setLoading(false);
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

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

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-accent-cyan transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent-cyan hover:text-accent-cyan/80 transition-colors">
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center border-t border-border/50 pt-6">
          <Link
            href="/extension"
            target="_blank"
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