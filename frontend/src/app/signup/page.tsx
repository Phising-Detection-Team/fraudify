"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Database, Mail, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { TermsModal } from "@/components/TermsModal";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

type SignupStep = "details" | "consent" | "provider";

const MIN_PASSWORD_LENGTH = 11;

const validateEmail = (value: string): string | null => {
  // Allow demo usernames like "demo-user" but require valid email pattern for actual emails
  if (value.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return "Please enter a valid email address.";
    }
  } else if (value.trim().length === 0) {
    return "Email or username is required.";
  }
  return null;
};

const validatePassword = (value: string): string | null => {
  if (value.length < MIN_PASSWORD_LENGTH) {
    return "Password must be more than 10 characters.";
  }

  if (!/\d/.test(value)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must include at least one symbol.";
  }

  return null;
};

const getPasswordStrength = (value: string): { score: number; label: string; colorClass: string } => {
  const checks = [
    value.length >= MIN_PASSWORD_LENGTH,
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
    /[a-z]/.test(value) && /[A-Z]/.test(value),
  ];

  const score = checks.filter(Boolean).length;

  if (score <= 1) {
    return { score, label: "Weak", colorClass: "bg-red-500" };
  }

  if (score === 2) {
    return { score, label: "Fair", colorClass: "bg-amber-500" };
  }

  if (score === 3) {
    return { score, label: "Good", colorClass: "bg-cyan-500" };
  }

  return { score, label: "Strong", colorClass: "bg-emerald-500" };
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [showAdminSecret, setShowAdminSecret] = useState(false);

  // Default to just read
  const [allowTraining, setAllowTraining] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const passwordValidationError = validatePassword(password);
  const emailValidationError = validateEmail(email);
  const passwordStrength = getPasswordStrength(password);
  const isContinueDisabled = !name.trim() || !email.trim() || !!passwordValidationError || !!emailValidationError;

  const handleNextToConsent = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("consent");
  };

  const handleNextToProvider = () => {
    if (!termsAccepted) {
      alert("Please accept the Terms and Agreements to continue.");
      return;
    }
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
          name,
          password,
          admin_secret: adminSecret.trim() || undefined,
          allow_training: allowTraining,
          terms_accepted: termsAccepted,
          provider,
        })
      });

      const signupData = await signupResponse.json();

      // 409 means user exists, we can still proceed to link mailbox
      if (!signupResponse.ok && signupResponse.status !== 409) {
        alert(signupData.message || signupData.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Save minimal safe identifiers for the callback, NOT the password
      const userId = signupData.user?.id;
      const roles = signupData.user?.roles || ['user'];

      // 2. Obtain the OAuth Redirect URL
      const scope = allowTraining ? "read_and_train" : "read";
      const authUrlResponse = await fetch(`http://localhost:5000/api/auth/url?provider=${provider}&scope=${scope}&user_id=${userId}`);
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
      console.error("Signup error:", err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Error during signup process: ${message}`);
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
                  placeholder="Your Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) {
                      setEmailError(validateEmail(e.target.value));
                    }
                  }}
                  onBlur={() => {
                    setEmailError(validateEmail(email));
                  }}
                  className={`w-full bg-background/50 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 ${emailError ? "border-red-500/70" : "border-border/50"}`}
                  placeholder="you@example.com"
                />
                {emailError && <p className="text-xs text-red-400">{emailError}</p>}
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
                    placeholder="••••••••"
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
              <div className="space-y-2">
                <label className="text-sm font-medium flex justify-between">
                  <span>Admin Secret</span>
                  <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminSecret ? "text" : "password"}
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                    className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                    placeholder="Enter secret for admin access"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAdminSecret(!showAdminSecret)}
                    tabIndex={-1}
                  >
                    {showAdminSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover:bg-background/50 transition-colors">
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border border-border shrink-0">
                    <input
                      type="checkbox"
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    {termsAccepted && <Check className="w-3.5 h-3.5 text-accent-cyan" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Required: Terms &amp; Agreements</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      I have read and agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-accent-cyan hover:underline"
                      >
                        Terms &amp; Agreements
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-accent-cyan hover:underline"
                      >
                        Privacy Policy
                      </button>.
                    </p>
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
                  disabled={!termsAccepted}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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

              {oauthError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-4 py-3 text-center">
                  Connection failed: <span className="font-mono">{oauthError}</span>. Please try again.
                </div>
              )}

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

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}