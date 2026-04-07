"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { config } from "@/lib/config";
import { Logo } from "@/components/Logo";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";
import { TermsModal } from "@/components/TermsModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ArrowRight, Check, Eye, EyeOff, AlertCircle,
  Mail, Loader2, MailCheck, ShieldCheck, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  signupWithBackend,
  sendVerificationEmail,
  verifyEmailWithCode,
} from "@/lib/auth-api";

type SignupStep = "details" | "consent" | "provider" | "verify";

function SignupForm(): JSX.Element {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>("details");

  // User details (kept in state so signIn can use email/password after verification)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowTraining, setAllowTraining] = useState(false);

  // Consent modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [hasViewedPrivacy, setHasViewedPrivacy] = useState(false);
  const [hasViewedTerms, setHasViewedTerms] = useState(false);

  // Verify step
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifyError, setVerifyError] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  // General loading/error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ---------------------------------------------------------------------------
  // Password validation
  // ---------------------------------------------------------------------------
  const hasMinLength = password.length > 10;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasSymbol;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isDetailsStepValid = email && isEmailValid && password && isPasswordValid;

  const passwordStrength = [hasMinLength, hasNumber, hasSymbol].filter(Boolean).length;
  const strengthLabels = ["Weak", "Fair", "Fair", "Strong"];
  const strengthColors = ["text-red-500", "text-yellow-500", "text-yellow-500", "text-green-500"];

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------
  const handleNextToConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDetailsStepValid) setStep("consent");
  };

  const handleNextToProvider = () => {
    if (privacyAgreed && termsAgreed) setStep("provider");
  };

  // Step 3 → 4: create account + send verification email
  const handleSendVerification = async () => {
    setLoading(true);
    try {
      // 1. Create the user account securely BEFORE redirecting.
      // If an invite code is present in the URL, use the admin signup endpoint.
      const signupEndpoint = inviteCode
        ? config.API.AUTH.ADMIN_SIGNUP
        : config.API.AUTH.SIGNUP;

      const signupBody: Record<string, string | null> = {
        email,
        password,
        username: name || email.split("@")[0],
      };
      if (inviteCode) {
        signupBody.invite_code = inviteCode;
      }

      const signupResponse = await fetch(`${config.API.BASE_URL}${signupEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupBody),
      });
      const signupResult = await signupWithBackend(email, password, name);
      if (!signupResult.success) {
        // 409 means account exists but not verified — try to resend
        if (signupResult.message?.includes("not yet verified")) {
          const resend = await sendVerificationEmail(email);
          if (resend.success) {
            setStep("verify");
            setLoading(false);
            return;
          }
        }
        setError(signupResult.error || "Failed to create account");
        setLoading(false);
        return;
      }

      setStep("verify");
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: verify with 6-digit code
  const handleVerify = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) {
      setVerifyError("Please enter all 6 digits");
      return;
    }
    setLoading(true);
    setVerifyError("");

    const result = await verifyEmailWithCode(email, code);
    if (!result.success || !result.data) {
      setVerifyError(result.error || "Invalid or expired code. Please try again.");
      setLoading(false);
      return;
    }

    // Establish NextAuth session
    const signInResult = await signIn("credentials", { redirect: false, email, password });
    if (!signInResult?.ok) {
      setVerifyError("Verification succeeded but sign-in failed. Please try logging in.");
      setLoading(false);
      return;
    }

    router.push(config.ROUTES.DASHBOARD_USER);
  };

  const handleResend = async () => {
    setResendStatus("sending");
    await sendVerificationEmail(email);
    setResendStatus("sent");
    setTimeout(() => setResendStatus("idle"), 4000);
  };

  // ---------------------------------------------------------------------------
  // OTP input handlers
  // ---------------------------------------------------------------------------
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setVerifyError("");
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerify();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otpDigits];
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
          {/* ================================================================
              STEP 1: Details
          ================================================================ */}
          {step === "details" && (
            <motion.form
              key="details"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              onSubmit={handleNextToConsent}
              className="space-y-4"
            >
              {inviteCode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-accent-cyan">Invite Code</label>
                  <input
                    data-testid="invite-code-input"
                    type="text"
                    readOnly
                    value={inviteCode}
                    className="w-full bg-accent-cyan/5 border border-accent-cyan/30 rounded-lg px-4 py-3 text-sm text-accent-cyan cursor-default"
                  />
                </div>
              )}

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
                              ? passwordStrength === 3 ? "bg-green-500" : "bg-yellow-500"
                              : "bg-border/50"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="space-y-1 mt-3">
                      {[
                        { ok: hasMinLength, label: "More than 10 characters" },
                        { ok: hasNumber, label: "At least one number (0-9)" },
                        { ok: hasSymbol, label: "At least one symbol (!@#$%^&* etc.)" },
                      ].map(({ ok, label }) => (
                        <div key={label} className={`text-xs flex items-center gap-2 ${ok ? "text-green-500" : "text-muted-foreground"}`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${ok ? "bg-green-500/20 border border-green-500/50" : "bg-border/30 border border-border/50"}`}>
                            {ok && <Check size={12} />}
                          </div>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

          {/* ================================================================
              STEP 2: Consent
          ================================================================ */}
          {step === "consent" && (
            <motion.div
              key="consent"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-accent-cyan/10 border border-accent-cyan/20 p-6 rounded-xl space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">Email Scanning & Real-time Protection</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sentra requires read access to your inbox to detect and prevent phishing threats in real-time.
                      Your emails are scanned instantly by our security agents. Messages are not stored unless you request it.
                    </p>
                  </div>
                </div>

                <div className="border-t border-accent-cyan/10" />

                {/* Privacy Policy */}
                <label className={`flex items-start gap-3 cursor-pointer transition-all ${!hasViewedPrivacy ? "opacity-60 cursor-not-allowed" : ""}`}>
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border-2 border-border flex-shrink-0">
                    <input type="checkbox" className="absolute opacity-0 w-full h-full cursor-pointer" disabled={!hasViewedPrivacy} checked={privacyAgreed} onChange={(e) => setPrivacyAgreed(e.target.checked)} />
                    {privacyAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-medium ${!hasViewedPrivacy ? "opacity-60" : ""}`}>I agree to the Privacy Policy</h4>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setShowPrivacyModal(true); }} className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex-shrink-0">
                        {hasViewedPrivacy ? "✓ Read" : "Read"}
                      </button>
                    </div>
                  </div>
                </label>

                {/* Terms */}
                <label className={`flex items-start gap-3 cursor-pointer transition-all ${!hasViewedTerms ? "opacity-60 cursor-not-allowed" : ""}`}>
                  <div className="mt-1 relative flex items-center justify-center w-5 h-5 rounded border-2 border-border flex-shrink-0">
                    <input type="checkbox" className="absolute opacity-0 w-full h-full cursor-pointer" disabled={!hasViewedTerms} checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} />
                    {termsAgreed && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-medium ${!hasViewedTerms ? "opacity-60" : ""}`}>I agree to the Terms & Agreements</h4>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }} className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex-shrink-0">
                        {hasViewedTerms ? "✓ Read" : "Read"}
                      </button>
                    </div>
                  </div>
                </label>
              </div>

              {/* Optional training */}
              <label className="flex items-start gap-3 p-4 rounded-lg border border-border/50 cursor-pointer hover:bg-background/50 transition-colors">
                <div className="w-5 h-5 rounded border-2 border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                  <input type="checkbox" className="absolute opacity-0 w-5 h-5 cursor-pointer" checked={allowTraining} onChange={(e) => setAllowTraining(e.target.checked)} />
                  {allowTraining && <Check className="w-3.5 h-3.5 text-accent-purple" />}
                </div>
                <div>
                  <h4 className="text-sm font-medium">Optional: Help improve Sentra</h4>
                  <p className="text-xs text-muted-foreground mt-1">Allow Sentra to securely store anonymized metadata to fine-tune our detection models.</p>
                </div>
              </label>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setStep("details")} className="flex-1 px-4 py-2 rounded-lg border border-border/50 hover:bg-background/50 text-sm transition-colors">Back</button>
                <button onClick={handleNextToProvider} disabled={!privacyAgreed || !termsAgreed} className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
              </div>
            </motion.div>
          )}

          {/* ================================================================
              STEP 3: Provider — send verification email
          ================================================================ */}
          {step === "provider" && (
            <motion.div
              key="provider"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center mx-auto">
                  <MailCheck className="w-7 h-7 text-accent-cyan" />
                </div>
                <h2 className="font-semibold text-lg">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll send a verification code to <span className="text-foreground font-medium">{email}</span> to confirm it&apos;s yours.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <button
                onClick={handleSendVerification}
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? "Sending…" : "Send Verification Email"}
              </button>

              <button type="button" onClick={() => setStep("consent")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                Back
              </button>
            </motion.div>
          )}

          {/* ================================================================
              STEP 4: Verify — enter 6-digit code
          ================================================================ */}
          {step === "verify" && (
            <motion.div
              key="verify"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                  <Mail className="w-7 h-7 text-green-400" />
                </div>
                <h2 className="font-semibold text-lg">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>.
                  Enter it below or click the link in the email.
                </p>
                <p className="text-xs text-muted-foreground/70">The code expires in 15 minutes.</p>
              </div>

              {/* OTP input */}
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`w-11 h-14 text-center text-xl font-bold bg-background/50 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      verifyError
                        ? "border-red-500/50 focus:ring-red-500/50"
                        : "border-border/50 focus:ring-accent-cyan/50"
                    }`}
                  />
                ))}
              </div>

              {verifyError && (
                <p className="text-xs text-red-500 text-center flex items-center justify-center gap-1">
                  <AlertCircle size={14} /> {verifyError}
                </p>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || otpDigits.join("").length < 6}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {loading ? "Verifying…" : "Verify Email"}
              </button>

              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Didn&apos;t receive it?</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendStatus !== "idle"}
                  className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors flex items-center gap-1 mx-auto disabled:opacity-60"
                >
                  {resendStatus === "sending" && <Loader2 size={12} className="animate-spin" />}
                  {resendStatus === "sent" && <Check size={12} />}
                  {resendStatus === "idle" && <RefreshCw size={12} />}
                  {resendStatus === "idle" ? "Resend email" : resendStatus === "sending" ? "Sending…" : "Email sent!"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => { setShowPrivacyModal(false); setHasViewedPrivacy(true); }}
      />
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => { setShowTermsModal(false); setHasViewedTerms(true); }}
      />
    </div>
  );
  }

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
