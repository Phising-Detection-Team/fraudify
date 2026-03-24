
"use client";

import { useEffect, useRef } from "react";
import { Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll when opened
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
                <Lock className="text-accent-purple" size={22} />
                <div>
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: "hsl(var(--accent-purple))" }}>
                    Privacy Policy
                  </h2>
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
              <p className="text-gray-500 text-xs">
                This Privacy Policy explains how PhishGuard (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
                collects, uses, stores, and protects your personal data when you use the Sentra phishing detection
                service, including our web platform, browser extension, and email scanning features.
              </p>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">1. Information We Collect</h3>
                <p className="font-medium mb-1">Account Information</p>
                <p>
                  When you register, we collect your name, email address, and a hashed version of your password.
                  If you register as an administrator, we also record the invite code used.
                </p>
                <p className="font-medium mt-3 mb-1">Email Access &amp; Scanning Data</p>
                <p>
                  To provide phishing detection, we request read-only access to your Gmail or Outlook inbox via OAuth
                  2.0. We do <strong>not</strong> store the full content of your emails. Our agents analyse message
                  headers, sender reputation, link patterns, and contextual signals in real time. Emails are processed
                  transiently and are not persisted unless you have explicitly opted in to training data collection.
                </p>
                <p className="font-medium mt-3 mb-1">OAuth Tokens</p>
                <p>
                  We store OAuth access and refresh tokens, encrypted at rest, solely to maintain your connected
                  mailbox. These tokens are scoped to read-only access and can be revoked at any time from your account
                  settings or directly through your Google / Microsoft account.
                </p>
                <p className="font-medium mt-3 mb-1">Usage &amp; Technical Data</p>
                <p>
                  We may collect browser type, operating system version, IP address (anonymised after 30 days), and
                  interaction events (e.g., which features you use) to operate and improve the Service.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">2. How We Use Your Information</h3>
                <ul className="ml-4 space-y-1.5 list-disc list-outside">
                  <li><strong>Phishing detection:</strong> Analysing incoming emails in real time to identify and flag threats.</li>
                  <li><strong>Account management:</strong> Creating and maintaining your account, sending verification and security emails.</li>
                  <li><strong>Service improvement:</strong> If you opt in, anonymised email metadata and detection outcomes are used to fine-tune our machine-learning models.</li>
                  <li><strong>Security &amp; fraud prevention:</strong> Detecting and preventing abuse, unauthorised access, or violations of our Terms.</li>
                  <li><strong>Communications:</strong> Sending transactional emails (e.g., email verification, password reset). We do not send marketing emails without your explicit consent.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">3. Data Sharing &amp; Third Parties</h3>
                <p>
                  We do <strong>not</strong> sell, rent, or trade your personal data. We may share data only in the
                  following limited circumstances:
                </p>
                <ul className="mt-2 ml-4 space-y-1.5 list-disc list-outside">
                  <li>
                    <strong>Infrastructure providers:</strong> Cloud hosting and database providers under strict
                    data-processing agreements (e.g., AWS, GCP). These providers act as data processors and may not
                    use your data for their own purposes.
                  </li>
                  <li>
                    <strong>Email delivery:</strong> Transactional emails are delivered through a third-party email
                    service (e.g., Resend). Only your email address and message content are shared.
                  </li>
                  <li>
                    <strong>Legal obligations:</strong> We may disclose information if required by law, regulation,
                    or valid legal process, or to protect the rights, property, or safety of PhishGuard, our users,
                    or the public.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">4. Data Retention</h3>
                <p>
                  We retain your account data for as long as your account is active. If you delete your account, we
                  will remove your personal data within 30 days, except where retention is required by law (e.g., for
                  audit logs, which are retained for up to 12 months). Anonymised, aggregated data not linked to any
                  individual may be retained indefinitely for research purposes.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">5. Data Security</h3>
                <p>
                  We implement industry-standard security measures including TLS encryption in transit, AES-256
                  encryption at rest for sensitive credentials, hashed passwords (bcrypt), and role-based access
                  controls. We conduct regular security reviews and penetration tests. However, no system is completely
                  secure, and we cannot guarantee absolute security.
                </p>
                <p className="mt-2">
                  If we become aware of a data breach that affects your personal data, we will notify you and relevant
                  authorities as required by applicable law within 72 hours.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">6. Your Rights</h3>
                <p>Depending on your location, you may have the right to:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li><strong>Access</strong> the personal data we hold about you.</li>
                  <li><strong>Rectify</strong> inaccurate or incomplete data.</li>
                  <li><strong>Erase</strong> your personal data (&ldquo;right to be forgotten&rdquo;).</li>
                  <li><strong>Restrict</strong> or <strong>object</strong> to certain processing activities.</li>
                  <li><strong>Data portability</strong> — receive your data in a machine-readable format.</li>
                  <li><strong>Withdraw consent</strong> for training data collection at any time from account settings.</li>
                  <li><strong>Revoke OAuth access</strong> to your mailbox at any time.</li>
                </ul>
                <p className="mt-2">
                  To exercise any of these rights, contact us at{" "}
                  <span className="text-accent-cyan">support@phishguard.io</span>. We will respond within 30 days.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">7. Cookies &amp; Tracking</h3>
                <p>
                  Our web platform uses essential session cookies required for authentication and security. We do not
                  use advertising or third-party tracking cookies. You may configure your browser to block cookies, but
                  doing so may impair certain features of the Service.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">8. Children&rsquo;s Privacy</h3>
                <p>
                  The Service is not directed at children under the age of 13. We do not knowingly collect personal
                  data from children under 13. If we learn that we have inadvertently collected such data, we will
                  delete it promptly.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">9. International Data Transfers</h3>
                <p>
                  Your data may be processed in countries outside your country of residence. Where we transfer data
                  internationally, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses
                  approved by the relevant regulatory authority.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">10. Changes to This Policy</h3>
                <p>
                  We may update this Privacy Policy periodically. We will notify you of material changes via email or
                  an in-app notice at least 14 days before they take effect. Continued use of the Service after the
                  effective date constitutes your acceptance of the revised policy.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">11. Contact &amp; Data Controller</h3>
                <p>For privacy-related enquiries or to exercise your rights, please contact:</p>
                <address className="mt-2 not-italic text-gray-500">
                  PhishGuard Privacy Team<br />
                  <span className="text-accent-cyan">support@phishguard.io</span>
                </address>
              </section>

              <p className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
                Privacy Policy &mdash; Version 1.0 &mdash; Effective March 2026
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
