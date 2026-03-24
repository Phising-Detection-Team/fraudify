"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare, Square, ShieldCheck, ArrowUp } from "lucide-react";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";

export default function TermsPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasReadAll, setHasReadAll] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
      if (atBottom) setHasReadAll(true);
      setShowScrollTop(el.scrollTop > 200);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="w-full max-w-3xl mb-6 flex items-center gap-3">
        <ShieldCheck className="text-accent-cyan" size={28} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight neon-text">
            Terms &amp; Agreements
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PhishGuard Browser Extension &mdash; Last updated March 2026
          </p>
        </div>
      </div>

      {/* Scroll hint */}
      {!hasReadAll && (
        <div className="w-full max-w-3xl mb-3 flex items-center gap-2 text-xs text-accent-cyan/80 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg px-4 py-2">
          <span className="animate-pulse">&#8595;</span>
          Scroll to the bottom to read all terms before accepting.
        </div>
      )}

      {/* Terms content */}
      <div
        ref={scrollRef}
        className="glass-panel rounded-2xl w-full max-w-3xl overflow-y-auto"
        style={{ maxHeight: "60vh" }}
      >
        <div className="p-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By installing, accessing, or using the PhishGuard browser extension
              (&ldquo;Extension&rdquo;) or its associated web platform
              (&ldquo;Service&rdquo;), you (&ldquo;User&rdquo;) agree to be bound
              by these Terms &amp; Agreements (&ldquo;Terms&rdquo;). If you do not
              agree to these Terms in their entirety, you must not install or use
              the Extension or Service. These Terms constitute a legally binding
              agreement between you and PhishGuard (&ldquo;Company,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              2. Description of Service
            </h2>
            <p>
              PhishGuard is a browser extension designed to detect and warn users
              about potential phishing websites, malicious links, and fraudulent
              online content in real time. The Service uses machine-learning models,
              URL analysis, domain reputation data, and user-contributed feedback to
              assess the safety of web pages.
            </p>
            <p className="mt-2">
              The Extension operates as a client-side tool that communicates with
              our backend servers to retrieve threat intelligence and submit
              anonymised URL scan data. The Service is provided on an
              &ldquo;as-is&rdquo; basis and is continuously updated to improve
              detection accuracy.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              3. Eligibility
            </h2>
            <p>
              You must be at least 13 years of age to use the Service. If you are
              under 18, you represent that your parent or legal guardian has reviewed
              and agreed to these Terms on your behalf. By using the Service, you
              represent and warrant that you meet the applicable eligibility
              requirements.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              4. User Account &amp; Registration
            </h2>
            <p>
              Certain features of the Service require you to register for an account.
              You agree to provide accurate, current, and complete information during
              registration and to update such information to keep it accurate. You are
              solely responsible for safeguarding your account credentials and for all
              activity that occurs under your account.
            </p>
            <p className="mt-2">
              You must notify us immediately at{" "}
              <span className="text-accent-cyan">support@phishguard.io</span> if you
              suspect unauthorised use of your account. We are not liable for any
              loss arising from your failure to secure your credentials.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              5. Data Collection &amp; Privacy
            </h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-accent-cyan hover:underline"
              >
                Privacy Policy
              </button>
              , which is incorporated into these Terms by reference. By using the
              Service, you consent to the data practices described therein.
            </p>
            <p className="mt-2">
              <strong>What we collect:</strong> URLs of pages you visit (anonymised
              or hashed where possible), extension interaction events, device
              information (browser type, OS version), and account data you
              voluntarily provide.
            </p>
            <p className="mt-2">
              <strong>What we do not collect:</strong> Passwords, form inputs,
              payment information, or the full content of web pages. We do not sell
              your personal data to third parties.
            </p>
            <p className="mt-2">
              <strong>Training data:</strong> If you opt in, anonymised URL scan
              results may be used to improve our machine-learning models. You may
              withdraw this consent at any time from your account settings.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              6. Permitted Use
            </h2>
            <p>You agree to use the Extension and Service only for lawful purposes. You must not:</p>
            <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
              <li>
                Attempt to reverse-engineer, decompile, or disassemble the Extension
                or its backend systems.
              </li>
              <li>
                Use the Service to facilitate phishing, fraud, or any other
                malicious activity.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the Service
                or its infrastructure.
              </li>
              <li>
                Submit false threat reports or abuse the feedback system to harm
                legitimate websites.
              </li>
              <li>
                Circumvent, disable, or otherwise interfere with security features of
                the Service.
              </li>
              <li>
                Scrape, crawl, or harvest data from the Service without our prior
                written consent.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              7. Intellectual Property
            </h2>
            <p>
              All rights, title, and interest in and to the Extension, Service,
              associated software, machine-learning models, brand assets, and
              documentation are owned by or licensed to PhishGuard. These Terms do
              not grant you any ownership rights. Your use of the Service is governed
              solely by the limited, non-exclusive, revocable licence set out herein.
            </p>
            <p className="mt-2">
              You retain ownership of any original content you submit (e.g., manual
              threat reports), but by submitting such content you grant us a
              worldwide, royalty-free, perpetual licence to use, modify, and
              incorporate it into the Service.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              8. Disclaimers &amp; Limitation of Liability
            </h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
              AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p className="mt-2">
              PhishGuard does not guarantee that the Extension will detect every
              phishing attempt or malicious website. No security tool is infallible.
              You agree that we are not liable for any damages, direct or indirect,
              arising from your reliance on the Extension&rsquo;s output.
            </p>
            <p className="mt-2">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
              PHISHGUARD&rsquo;S TOTAL LIABILITY TO YOU EXCEED THE GREATER OF (A)
              THE AMOUNT YOU PAID US IN THE 12 MONTHS PRIOR TO THE CLAIM OR (B)
              USD $50.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              9. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless PhishGuard and its
              officers, directors, employees, and agents from any claims, liabilities,
              damages, and expenses (including reasonable legal fees) arising out of
              your use of the Service, your violation of these Terms, or your
              infringement of any third-party rights.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              10. Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your account or access to
              the Service at any time and for any reason, including violation of these
              Terms, without prior notice or liability. Upon termination, your right
              to use the Service immediately ceases.
            </p>
            <p className="mt-2">
              You may terminate your account at any time by contacting us or using the
              account deletion option in settings. Upon deletion, we will remove your
              personal data in accordance with our Privacy Policy, subject to legal
              retention obligations.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              11. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we make material
              changes, we will notify you via email or an in-extension notice at least
              14 days before the changes take effect. Your continued use of the Service
              after the effective date constitutes your acceptance of the revised Terms.
              If you do not agree to the revised Terms, you must uninstall the Extension
              and delete your account.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              12. Governing Law &amp; Dispute Resolution
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of
              the jurisdiction in which PhishGuard is incorporated, without regard to
              its conflict-of-law provisions. Any dispute arising from these Terms
              shall first be attempted to be resolved through good-faith negotiation.
              If unresolved, disputes shall be submitted to binding arbitration in
              accordance with the applicable arbitration rules.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-base font-semibold mb-2 text-foreground">
              13. Contact
            </h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <address className="mt-2 not-italic text-muted-foreground">
              PhishGuard Support Team<br />
              <span className="text-accent-cyan">support@phishguard.io</span>
            </address>
          </section>

          {/* End sentinel */}
          <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border/40">
            End of Terms &amp; Agreements &mdash; Version 1.0
          </p>
        </div>
      </div>

      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 p-2 rounded-full glass-panel border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll to top"
        >
          <ArrowUp size={16} />
        </button>
      )}

      {/* Acceptance checkbox */}
      <div
        className={`w-full max-w-3xl mt-5 glass-panel rounded-2xl p-5 transition-opacity duration-300 ${
          hasReadAll ? "opacity-100" : "opacity-40 pointer-events-none"
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <button
            role="checkbox"
            aria-checked={accepted}
            disabled={!hasReadAll}
            onClick={() => setAccepted((v) => !v)}
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border border-border/60 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent-cyan/40"
            style={{
              background: accepted
                ? "hsl(var(--accent-cyan) / 0.15)"
                : "transparent",
              borderColor: accepted
                ? "hsl(var(--accent-cyan))"
                : undefined,
            }}
          >
            {accepted ? (
              <CheckSquare size={14} className="text-accent-cyan" />
            ) : (
              <Square size={14} className="text-muted-foreground" />
            )}
          </button>
          <span className="text-sm text-foreground/90 leading-snug">
            I have read and agree to the{" "}
            <strong>Terms &amp; Agreements</strong> and understand that
            PhishGuard will process data as described above. I confirm that I
            am at least 13 years of age.
          </span>
        </label>

        {accepted && (
          <p className="mt-3 text-xs text-accent-cyan/80 flex items-center gap-1.5">
            <ShieldCheck size={13} />
            You have accepted the Terms. You may now close this tab and continue
            with registration.
          </p>
        )}
      </div>

      {!hasReadAll && (
        <p className="mt-3 text-xs text-muted-foreground">
          Please scroll through all the terms above to enable the checkbox.
        </p>
      )}

      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}