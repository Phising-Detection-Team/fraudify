
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }

    fetch("http://localhost:5000/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified.");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Unable to connect to the server. Please try again.");
      });
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {status === "loading" && (
        <span className="animate-spin w-10 h-10 border-2 border-accent-cyan border-t-transparent rounded-full" />
      )}

      {status === "success" && (
        <>
          <CheckCircle size={48} className="text-accent-cyan" />
          <p className="text-sm text-center text-muted-foreground">{message}</p>
          <Link
            href="/login"
            className="mt-2 text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors"
          >
            Go to login →
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle size={48} className="text-red-400" />
          <p className="text-sm text-center text-red-400">{message}</p>
          <Link
            href="/login"
            className="mt-2 text-sm text-muted-foreground hover:text-accent-cyan transition-colors"
          >
            Go to login
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
          <h1 className="text-2xl font-bold tracking-tight">Email Verification</h1>
          <p className="text-muted-foreground text-sm mt-1">Verifying your email address…</p>
        </div>

        <Suspense fallback={<div className="flex justify-center"><span className="animate-spin w-10 h-10 border-2 border-accent-cyan border-t-transparent rounded-full" /></div>}>
          <VerifyEmailContent />
        </Suspense>
      </motion.div>
    </div>
  );
}
