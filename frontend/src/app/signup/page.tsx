"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Database, Mail, ArrowRight, Check } from "lucide-react";
import Link from "next/link";

type SignupStep = "details" | "consent" | "provider";

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  
  // Default to just read
  const [allowTraining, setAllowTraining] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNextToConsent = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("consent");
  };

  const handleNextToProvider = () => {
    setStep("provider");
  };

  const handleConnectProvider = async (provider: 'gmail' | 'outlook') => {
    setLoading(true);
    try {
      // 1. Create the user account securely BEFORE redirecting, 
      // preventing the need to store plaintext password in localStorage.
      const signupResponse = await fetch(`http://localhost:5000/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        })
      });
      
      const signupData = await signupResponse.json();
      
      // 409 means user exists, we can still proceed to link mailbox
      if (!signupResponse.ok && signupResponse.status !== 409) {
        alert(signupData.error || "Failed to create account");
        setLoading(false);
        return;
      }
      
      // Save minimal safe identifiers for the callback, NOT the password
      const userId = signupData.user?.id;
      const roles = signupData.user?.roles || ['user'];
      
      // 2. Obtain the OAuth Redirect URL
      const scope = allowTraining ? "read_and_train" : "read";
      const authUrlResponse = await fetch(`http://localhost:5000/api/auth/url?provider=${provider}&scope=${scope}`);
      const authUrlData = await authUrlResponse.json();
      
      if (authUrlData.url) {
        // Only store safe data. NEVER store passwords in localStorage.
        localStorage.setItem("sentra-pending-signup", JSON.stringify({ 
          email, 
          userId, 
          scope, 
          roles 
        }));
        window.location.href = authUrlData.url;
      } else {
        alert("Failed to get authorization URL");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error during signup process");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-md p-8 rounded-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan to-accent-purple" />
        
        <div className="flex flex-col items-center mb-8">
          <Logo className="mb-6 scale-110" />
          <h1 className="text-2xl font-bold tracking-tight">Create your Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join Sentra to protect your inbox</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "details" && (
            <motion.form 
              key="details"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              onSubmit={handleNextToConsent} 
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
<<<<<<< HEAD
                  placeholder="john@example.com"
=======
                  placeholder="john@example.com / demo-user"
>>>>>>> 1720d2e (feat: add signup page with multi-step form; implement secure user registration and OAuth integration)
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex justify-between">
                  <span>Admin Secret</span>
                  <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="password"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  placeholder="Enter secret for admin access"
                />
              </div>
              <button
                type="submit"
                className="w-full btn-primary flex items-center justify-center gap-2 group mt-6"
              >
                Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="text-center mt-6">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-accent-cyan hover:text-accent-cyan/80 transition-colors">
                    Sign In
                  </Link>
                </p>
              </div>
            </motion.form>
          )}

          {step === "consent" && (
            <motion.div 
              key="consent"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-accent-cyan/10 border border-accent-cyan/20 p-4 rounded-xl flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-accent-cyan shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Email scanning required</h3>
                  <p className="text-xs text-muted-foreground">In order to detect phishing, Sentra requires read access to your inbox. Your emails are scanned real-time by our agents.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-background/50 transition-colors">
                  <div className="mt-1 flex items-center justify-center w-5 h-5 rounded border border-accent-cyan/50 bg-accent-cyan/20">
                    <Check className="w-3.5 h-3.5 text-accent-cyan" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Required: Real-time Scanning</h4>
                    <p className="text-xs text-muted-foreground mt-1">Allow Sentra to read emails to identify phishing threats. Messages are not stored permanently unless requested.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-background/50 transition-colors">
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border border-border">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                      checked={allowTraining}
                      onChange={(e) => setAllowTraining(e.target.checked)}
                    />
                    {allowTraining && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Optional: Help improve Sentra</h4>
                    <p className="text-xs text-muted-foreground mt-1">Allow Sentra to securely store anonymized metadata and message contexts to fine-tune our detection models.</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="flex-1 px-4 py-2 rounded-lg border border-border/50 hover:bg-background/50 text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNextToProvider}
                  className="flex-1 btn-primary"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          )}

          {step === "provider" && (
            <motion.div 
              key="provider"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-muted-foreground text-center mb-6">Select your email provider to connect your inbox and finalize registration.</p>

              <button
                onClick={() => handleConnectProvider('gmail')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:bg-background/50 transition-colors disabled:opacity-50"
              >
                <Mail className="w-5 h-5" />
                <span className="font-medium">Connect Gmail</span>
              </button>

              <button
                onClick={() => handleConnectProvider('outlook')}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-border/50 hover:bg-background/50 transition-colors disabled:opacity-50"
              >
                <Database className="w-5 h-5" />
                <span className="font-medium">Connect Outlook</span>
              </button>

              <button
                type="button"
                className="w-full mt-4 text-xs text-muted-foreground hover:text-white transition-colors"
                onClick={() => setStep("consent")}
              >
                Back to privacy settings
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
