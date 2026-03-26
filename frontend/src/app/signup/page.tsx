"use client";

import { useState } from "react";
import { config } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";
import { TermsModal } from "@/components/TermsModal";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Database, Mail, ArrowRight, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";

type SignupStep = "details" | "consent" | "modals" | "provider";

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Default to just read
  const [allowTraining, setAllowTraining] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [hasViewedPrivacy, setHasViewedPrivacy] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);

  // Password validation helpers
  const hasMinLength = password.length > 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasSymbol;

  // Email validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Password strength indicator
  const getPasswordStrength = () => {
    let strength = 0;
    if (hasMinLength) strength += 1;
    if (hasNumber) strength += 1;
    if (hasSymbol) strength += 1;
    return strength;
  };

  const passwordStrength = getPasswordStrength();
  const strengthLabels = ["Weak", "Fair", "Fair", "Strong"];
  const strengthColors = [
    "text-red-500",
    "text-yellow-500",
    "text-yellow-500",
    "text-green-500",
  ];

  const isDetailsStepValid = email && isEmailValid && password && isPasswordValid;


  const handleNextToConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDetailsStepValid) {
      setStep("consent");
    }
  };

  const handleNextToProvider = () => {
    if (privacyAgreed && termsAgreed) {
      setStep("provider");
    }
  };

  const handleCompleteModals = () => {
    if (privacyAgreed && termsAgreed) {
      setStep("provider");
    }
  };

  const handleConnectProvider = async (provider: 'gmail' | 'outlook') => {
    setLoading(true);
    try {
      // 1. Create the user account securely BEFORE redirecting, 
      // preventing the need to store plaintext password in localStorage.
      const signupResponse = await fetch(config.API.AUTH.SIGNUP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name || null,
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
      const authUrlResponse = await fetch(`${config.API.AUTH.AUTH_URL}?provider=${provider}&scope=${scope}`);
      const authUrlData = await authUrlResponse.json();
      
      if (authUrlData.url) {
        // Only store safe data. NEVER store passwords in localStorage.
        localStorage.setItem(config.STORAGE_KEYS.PENDING_SIGNUP, JSON.stringify({ 
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
                <label className="text-sm font-medium flex justify-between">
                  <span>Full Name</span>
                  <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                  placeholder="Your Name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-background/50 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
                    email && !isEmailValid 
                      ? "border-red-500/50 focus:ring-red-500/50" 
                      : "border-border/50 focus:ring-accent-cyan/50"
                  }`}
                  placeholder="you@example.com"
                />
                {email && !isEmailValid && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={14} /> Please enter a valid email address
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-background/50 border rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 ${
                      password && !isPasswordValid
                        ? "border-red-500/50 focus:ring-red-500/50"
                        : "border-border/50 focus:ring-accent-cyan/50"
                    }`}
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

                {password && (
                  <div className="space-y-2 mt-3 p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">Password Strength</span>
                      <span className={`text-xs font-semibold ${strengthColors[passwordStrength]}`}>
                        {strengthLabels[passwordStrength]}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1.5 rounded-full transition-colors ${
                            i < passwordStrength
                              ? passwordStrength === 3
                                ? "bg-green-500"
                                : "bg-yellow-500"
                              : "bg-border/50"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="space-y-1 mt-3">
                      <div className={`text-xs flex items-center gap-2 ${hasMinLength ? "text-green-500" : "text-muted-foreground"}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasMinLength ? "bg-green-500/20 border border-green-500/50" : "bg-border/30 border border-border/50"}`}>
                          {hasMinLength && <Check size={12} />}
                        </div>
                        More than 10 characters
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${hasNumber ? "text-green-500" : "text-muted-foreground"}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasNumber ? "bg-green-500/20 border border-green-500/50" : "bg-border/30 border border-border/50"}`}>
                          {hasNumber && <Check size={12} />}
                        </div>
                        At least one number (0-9)
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${hasSymbol ? "text-green-500" : "text-muted-foreground"}`}>
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${hasSymbol ? "bg-green-500/20 border border-green-500/50" : "bg-border/30 border border-border/50"}`}>
                          {hasSymbol && <Check size={12} />}
                        </div>
                        At least one symbol (!@#$%^&* etc.)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center">
                <p className="text-xs text-muted-foreground">
                  💡 Please ensure all fields are filled correctly. This helps us secure your account.
                </p>
              </div>

              <button
                type="submit"
                disabled={!isDetailsStepValid}
                className="w-full btn-primary flex items-center justify-center gap-2 group mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <div className="text-center border-t border-border/50 pt-4 mt-4">
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
              {/* Unified box with email scanning and policy checkboxes */}
              <div className="bg-accent-cyan/10 border border-accent-cyan/20 p-6 rounded-xl space-y-4">
                {/* Email Scanning Section */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">Email Scanning & Real-time Protection</h3>
                      <p className="text-xs text-muted-foreground mt-1">Sentra requires read access to your inbox to detect and prevent phishing threats in real-time. Your emails are scanned instantly by our security agents. Messages are not stored unless you request it.</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-accent-cyan/10" />

                {/* Privacy Policy Checkbox */}
                <label className={`flex items-start gap-3 cursor-pointer transition-all ${
                  hasViewedPrivacy 
                    ? "" 
                    : "opacity-60 cursor-not-allowed"
                }`}>
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border-2 border-border flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                      disabled={!hasViewedPrivacy}
                      checked={privacyAgreed}
                      onChange={(e) => setPrivacyAgreed(e.target.checked)}
                    />
                    {privacyAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-medium ${!hasViewedPrivacy ? "opacity-60" : ""}`}>
                        I agree to the Privacy Policy
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPrivacyModal(true);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex-shrink-0"
                      >
                        {hasViewedPrivacy ? "✓ Read" : "Read"}
                      </button>
                    </div>
                  </div>
                </label>

                {/* Terms & Agreements Checkbox */}
                <label className={`flex items-start gap-3 cursor-pointer transition-all ${
                  hasViewedTerms 
                    ? "" 
                    : "opacity-60 cursor-not-allowed"
                }`}>
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border-2 border-border flex-shrink-0">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                      disabled={!hasViewedTerms}
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                    />
                    {termsAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-medium ${!hasViewedTerms ? "opacity-60" : ""}`}>
                        I agree to the Terms & Agreements
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTermsModal(true);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex-shrink-0"
                      >
                        {hasViewedTerms ? "✓ Read" : "Read"}
                      </button>
                    </div>
                  </div>
                </label>
              </div>

              {/* Optional training checkbox */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 p-4 rounded-lg border border-border/50 cursor-pointer hover:bg-background/50 transition-colors">
                  <div className="w-5 h-5 rounded border-2 border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 w-5 h-5 cursor-pointer"
                      checked={allowTraining}
                      onChange={(e) => setAllowTraining(e.target.checked)}
                    />
                    {allowTraining && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div className="flex-1">
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
                  disabled={!privacyAgreed || !termsAgreed}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {step === "modals" && (
            <motion.div 
              key="modals"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground text-center">
                  📖 <span className="font-semibold">Important:</span> Please read our Privacy Policy and Terms & Agreements before continuing.
                </p>
              </div>

              <label className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                hasViewedPrivacy 
                  ? "border-border/50 cursor-pointer hover:bg-background/50" 
                  : "border-amber-500/20 bg-amber-500/5 cursor-not-allowed"
              }`}>
                <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border shrink-0" style={{
                  borderColor: hasViewedPrivacy ? undefined : "rgba(217, 119, 6, 0.3)"
                }}>
                  <input 
                    type="checkbox" 
                    className="absolute opacity-0 w-full h-full"
                    disabled={!hasViewedPrivacy}
                    checked={privacyAgreed}
                    onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  />
                  {privacyAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-medium ${!hasViewedPrivacy ? "opacity-60" : ""}`}>
                      I agree to the Privacy Policy
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrivacyModal(true);
                      }}
                      className="text-xs px-2 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                    >
                      {hasViewedPrivacy ? "✓ Read" : "Read Now"}
                    </button>
                  </div>
                  <p className={`text-xs mt-1 ${hasViewedPrivacy ? "text-muted-foreground" : "text-amber-600"}`}>
                    {hasViewedPrivacy 
                      ? "Review our privacy practices and data protection measures."
                      : "Click 'Read Now' to view the Privacy Policy before you can check this box."
                    }
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                hasViewedTerms 
                  ? "border-border/50 cursor-pointer hover:bg-background/50" 
                  : "border-amber-500/20 bg-amber-500/5 cursor-not-allowed"
              }`}>
                <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border shrink-0" style={{
                  borderColor: hasViewedTerms ? undefined : "rgba(217, 119, 6, 0.3)"
                }}>
                  <input 
                    type="checkbox" 
                    className="absolute opacity-0 w-full h-full"
                    disabled={!hasViewedTerms}
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                  />
                  {termsAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-medium ${!hasViewedTerms ? "opacity-60" : ""}`}>
                      I agree to the Terms & Agreements
                    </h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      className="text-xs px-2 py-1 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                    >
                      {hasViewedTerms ? "✓ Read" : "Read Now"}
                    </button>
                  </div>
                  <p className={`text-xs mt-1 ${hasViewedTerms ? "text-muted-foreground" : "text-amber-600"}`}>
                    {hasViewedTerms 
                      ? "Review the terms of service and user agreement."
                      : "Click 'Read Now' to view the Terms & Agreements before you can check this box."
                    }
                  </p>
                </div>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep("consent")}
                  className="flex-1 px-4 py-2 rounded-lg border border-border/50 hover:bg-background/50 text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteModals}
                  disabled={!privacyAgreed || !termsAgreed}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Proceed to Email Provider
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
                onClick={() => setStep("modals")}
              >
                Back to policies
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <PrivacyPolicyModal 
          isOpen={showPrivacyModal} 
          onClose={() => {
            setShowPrivacyModal(false);
            setHasViewedPrivacy(true);
          }} 
        />
        <TermsModal 
          isOpen={showTermsModal} 
          onClose={() => {
            setShowTermsModal(false);
            setHasViewedTerms(true);
          }} 
        />
      </motion.div>
    </div>
  );
}
