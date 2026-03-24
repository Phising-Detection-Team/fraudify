"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  // Reset scroll position when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "85vh", backgroundColor: "#ffffff", color: "#111111" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-accent-cyan" size={22} />
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Terms &amp; Agreements</h2>
                  <p className="text-xs text-gray-500">PhishGuard — Last updated March 2026</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm leading-relaxed text-gray-700"
            >
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">1. Acceptance of Terms</h3>
                <p>
                  By installing, accessing, or using the PhishGuard browser extension (&ldquo;Extension&rdquo;) or its
                  associated web platform (&ldquo;Service&rdquo;), you (&ldquo;User&rdquo;) agree to be bound by these
                  Terms &amp; Agreements (&ldquo;Terms&rdquo;). If you do not agree to these Terms in their entirety,
                  you must not install or use the Extension or Service. These Terms constitute a legally binding
                  agreement between you and PhishGuard (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
                  &ldquo;our&rdquo;).
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">2. Description of Service</h3>
                <p>
                  PhishGuard is a browser extension designed to detect and warn users about potential phishing websites,
                  malicious links, and fraudulent online content in real time. The Service uses machine-learning models,
                  URL analysis, domain reputation data, and user-contributed feedback to assess the safety of web pages.
                </p>
                <p className="mt-2">
                  The Extension operates as a client-side tool that communicates with our backend servers to retrieve
                  threat intelligence and submit anonymised URL scan data. The Service is provided on an
                  &ldquo;as-is&rdquo; basis and is continuously updated to improve detection accuracy.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">3. Eligibility</h3>
                <p>
                  You must be at least 13 years of age to use the Service. If you are under 18, you represent that your
                  parent or legal guardian has reviewed and agreed to these Terms on your behalf. By using the Service,
                  you represent and warrant that you meet the applicable eligibility requirements.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">4. User Account &amp; Registration</h3>
                <p>
                  Certain features of the Service require you to register for an account. You agree to provide accurate,
                  current, and complete information during registration and to update such information to keep it
                  accurate. You are solely responsible for safeguarding your account credentials and for all activity
                  that occurs under your account.
                </p>
                <p className="mt-2">
                  You must notify us immediately at{" "}
                  <span className="text-accent-cyan">support@phishguard.io</span> if you suspect unauthorised use of
                  your account. We are not liable for any loss arising from your failure to secure your credentials.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">5. Data Collection &amp; Privacy</h3>
                <p>
                  Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms
                  by reference. By using the Service, you consent to the data practices described therein.
                </p>
                <p className="mt-2">
                  <strong>What we collect:</strong> URLs of pages you visit (anonymised or hashed where possible),
                  extension interaction events, device information (browser type, OS version), and account data you
                  voluntarily provide.
                </p>
                <p className="mt-2">
                  <strong>What we do not collect:</strong> Passwords, form inputs, payment information, or the full
                  content of web pages. We do not sell your personal data to third parties.
                </p>
                <p className="mt-2">
                  <strong>Training data:</strong> If you opt in, anonymised URL scan results may be used to improve our
                  machine-learning models. You may withdraw this consent at any time from your account settings.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">6. Permitted Use</h3>
                <p>You agree to use the Extension and Service only for lawful purposes. You must not:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>Attempt to reverse-engineer, decompile, or disassemble the Extension or its backend systems.</li>
                  <li>Use the Service to facilitate phishing, fraud, or any other malicious activity.</li>
                  <li>Interfere with or disrupt the integrity or performance of the Service or its infrastructure.</li>
                  <li>Submit false threat reports or abuse the feedback system to harm legitimate websites.</li>
                  <li>Circumvent, disable, or otherwise interfere with security features of the Service.</li>
                  <li>Scrape, crawl, or harvest data from the Service without our prior written consent.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">7. Intellectual Property</h3>
                <p>
                  All rights, title, and interest in and to the Extension, Service, associated software,
                  machine-learning models, brand assets, and documentation are owned by or licensed to PhishGuard.
                  These Terms do not grant you any ownership rights. Your use of the Service is governed solely by the
                  limited, non-exclusive, revocable licence set out herein.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">8. Disclaimers &amp; Limitation of Liability</h3>
                <p>
                  THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY
                  KIND. PhishGuard does not guarantee that the Extension will detect every phishing attempt or malicious
                  website. No security tool is infallible. You agree that we are not liable for any damages, direct or
                  indirect, arising from your reliance on the Extension&rsquo;s output.
                </p>
                <p className="mt-2">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PHISHGUARD&rsquo;S TOTAL LIABILITY SHALL NOT
                  EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE PRIOR 12 MONTHS OR (B) USD $50.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">9. Indemnification</h3>
                <p>
                  You agree to indemnify and hold harmless PhishGuard and its officers, directors, employees, and agents
                  from any claims, liabilities, damages, and expenses arising out of your use of the Service, your
                  violation of these Terms, or your infringement of any third-party rights.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">10. Termination</h3>
                <p>
                  We reserve the right to suspend or terminate your account or access to the Service at any time and for
                  any reason, including violation of these Terms, without prior notice or liability.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">11. Changes to These Terms</h3>
                <p>
                  We may update these Terms from time to time. When we make material changes, we will notify you via
                  email or an in-extension notice at least 14 days before the changes take effect.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">12. Governing Law &amp; Dispute Resolution</h3>
                <p>
                  These Terms are governed by and construed in accordance with the laws of the jurisdiction in which
                  PhishGuard is incorporated. Disputes shall first be attempted to be resolved through good-faith
                  negotiation, then by binding arbitration.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">13. Contact</h3>
                <p>If you have any questions about these Terms, please contact us at:</p>
                <address className="mt-2 not-italic text-gray-500">
                  PhishGuard Support Team<br />
                  <span className="text-accent-cyan">support@phishguard.io</span>
                </address>
              </section>

              <p className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
                End of Terms &amp; Agreements &mdash; Version 1.0
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary px-6 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}