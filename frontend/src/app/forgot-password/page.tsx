"use client";

import { useState } from "react";
import Link from "next/link";
import { config } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await fetch(`${config.API.BASE_URL}${config.API.AUTH.FORGOT_PASSWORD}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success — never reveal whether email exists
      setSubmitted(true);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
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
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle size={48} className="text-accent-cyan" />
            <p className="text-sm text-center text-muted-foreground">
              If an account exists for <span className="text-foreground font-medium">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <Link
              href="/login"
              className="mt-2 text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="fp-email" className="text-sm font-medium">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  placeholder="you@example.com"
                />
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
              className="w-full btn-neon bg-foreground text-background font-semibold py-3 rounded-lg flex justify-center items-center gap-2"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-background border-t-transparent rounded-full" />
              ) : (
                "Send Reset Link"
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
        )}
      </motion.div>
    </div>
  );
}