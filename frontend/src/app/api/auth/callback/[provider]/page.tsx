"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const code = searchParams.get("code");
    const provider = params.provider as string;
    
    // In actual implementation, we might get signup details from local storage or session
    // to create the user, but for now we'll simulate the grant-email-access endpoint.
    const runCallback = async () => {
      if (!code) {
        setStatus("error");
        return;
      }

      try {
        const pendingSignupStr = localStorage.getItem("sentra-pending-signup");
        let scope = "read";
        let mockUserId = "00000000-0000-0000-0000-000000000000";
        let role = "user";
        
        if (pendingSignupStr) {
            const pendingSignup = JSON.parse(pendingSignupStr);
            scope = pendingSignup.scope || "read";
            if (pendingSignup.userId) {
                mockUserId = pendingSignup.userId;
            }
            if (pendingSignup.roles && pendingSignup.roles.includes("admin")) {
                role = "admin";
            }
        }
        
        const response = await fetch("http://localhost:5000/api/auth/grant-email-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            code,
            scope,
            user_id: mockUserId
          }),
        });

        if (response.ok) {
          setStatus("success");
          localStorage.removeItem("sentra-pending-signup");
          setTimeout(() => {
             // Mock setting role and redirecting to proper dashboard
             localStorage.setItem("sentra-role", role);
             router.push(`/dashboard/${role}`);
          }, 1500);
        } else {
          setStatus("error");
        }
      } catch (err) {
        console.error("Callback error", err);
        setStatus("error");
      }
    };

    runCallback();
  }, [searchParams, params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full max-w-sm p-8 rounded-2xl relative overflow-hidden flex flex-col items-center text-center"
      >
        <Logo className="mb-6" />
        
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-accent-cyan animate-spin mb-4" />
            <h2 className="text-xl font-semibold">Connecting your inbox...</h2>
            <p className="text-muted-foreground text-sm mt-2">Please wait while we verify your credentials.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold">Connection Successful</h2>
            <p className="text-muted-foreground text-sm mt-2">Redirecting you to your dashboard...</p>
          </>
        )}
        
        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold">Connection Failed</h2>
            <p className="text-muted-foreground text-sm mt-2">Failed to connect your inbox. Please try again.</p>
            <button 
              onClick={() => router.push("/signup")}
              className="mt-6 px-6 py-2 rounded-lg border border-border/50 hover:bg-background/50 transition-colors"
            >
              Return to Signup
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
