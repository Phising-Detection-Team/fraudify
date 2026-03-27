"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length <= 10) {
      setError("Password must be at least 11 characters.");
      return;
    }
    if (!/\d/.test(password)) {
      setError("Password must contain at least one number.");
      return;
    }
    if (!/[!@#$%^&*]/.test(password)) {
      setError("Password must contain at least one special character (!@#$%^&*).");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.RESET_PASSWORD}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to reset password. The link may have expired.");
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4 py-4">
        <p className="text-sm text-red-400">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="rp-password" className="text-sm font-medium">New Password</label>
        <div className="relative">
          <input
            id="rp-password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            placeholder="Min. 11 characters"
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
      </div>

      <div className="space-y-2">
        <label htmlFor="rp-confirm" className="text-sm font-medium">Confirm Password</label>
        <input
          id="rp-confirm"
          type={showPassword ? "text" : "password"}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          placeholder="Re-enter your password"
        />
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
        className="w-full btn-neon bg-foreground text-background font-semibold py-3 rounded-lg flex justify-center items-center gap-2"
      >
        {loading ? (
          <span className="animate-spin w-5 h-5 border-2 border-background border-t-transparent rounded-full" />
        ) : (
          "Reset Password"
        )}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-accent-cyan transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
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
          <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose a new password for your account.</p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  );
}