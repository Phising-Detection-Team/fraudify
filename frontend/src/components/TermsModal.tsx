"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset scroll position when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
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
                  <p className="text-xs text-gray-500">Sentra — Last updated March 2026</p>
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
                  By installing, accessing, or utilizing the Sentra browser extension (&ldquo;Extension&rdquo;) or its
                  accompanying web services (&ldquo;Service&rdquo;), you (&ldquo;User&rdquo;) agree to be bound by these
                  Terms &amp; Agreements (&ldquo;Terms&rdquo;). If you do not consent to these Terms in their entirety,
                  you must immediately cease using and uninstall the Extension and Service. This document forms a legally binding
                  contract between you and Sentra (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
                  &ldquo;our&rdquo;).
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">2. Description of Service</h3>
                <p>
                  Sentra provides a real-time security browser extension designed to identify and alert users to potential phishing websites,
                  malicious links, and deceptive online content. The Service evaluates web page safety using machine-learning algorithms,
                  URL analysis, domain reputation tracking, and community feedback.
                </p>
                <p className="mt-2">
                  Operating as a client-side application, the Extension communicates with our servers to access threat intelligence and securely submit
                  anonymized URL scan data. The Service is offered on an &ldquo;as-is&rdquo; basis and undergoes continuous updates to optimize
                  threat detection capabilities.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">3. Eligibility</h3>
                <p>
                  You must be at least 13 years old to use the Service. If you are between the ages of 13 and 18, you confirm that a
                  parent or legal guardian has reviewed and consented to these Terms on your behalf. By using Sentra, you represent and
                  warrant that you meet these eligibility requirements.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">4. User Account &amp; Registration</h3>
                <p>
                  Accessing certain features of the Service requires account registration. You agree to provide and maintain accurate,
                  current, and complete information. You are solely responsible for protecting your account credentials and for all activities
                  that occur under your account.
                </p>
                <p className="mt-2">
                  If you suspect any unauthorized access to your account, you must notify us immediately at{" "}
                  <span className="text-accent-cyan">cyberlab.dev@gmail.com</span>. Sentra assumes no liability for losses resulting from compromised
                  account credentials.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">5. Data Collection &amp; Privacy</h3>
                <p>
                  Your privacy is important to us. Your use of the Service is subject to our Privacy Policy, which is incorporated into these Terms
                  by reference. By using Sentra, you consent to our data practices:
                </p>
                <p className="mt-2">
                  <strong>Data We Collect:</strong> Hashed or anonymized URLs of visited pages, extension interaction metrics, device
                  details (such as operating system and browser type), and voluntarily provided account data.
                </p>
                <p className="mt-2">
                  <strong>Data We Exclude:</strong> We explicitly do not collect passwords, form inputs, financial data, or the full
                  content of any web page. We will never sell your personal data.
                </p>
                <p className="mt-2">
                  <strong>Training Data:</strong> With your explicit opt-in consent, anonymized URL scans may be utilized to refine our
                  machine-learning models. You retain the right to withdraw this consent at any time via your account settings.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">6. Permitted Use</h3>
                <p>You agree to use Sentra strictly for lawful, intended purposes. You are expressly prohibited from:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>Reverse-engineering, decompiling, or disassembling the Extension or backend infrastructure.</li>
                  <li>Leveraging the Service to execute phishing, fraud, or any malicious activities.</li>
                  <li>Disrupting, overburdening, or interfering with the Service&rsquo;s integrity or performance.</li>
                  <li>Submitting fraudulent threat reports or manipulating the feedback system to penalize legitimate websites.</li>
                  <li>Bypassing or disabling any security protocols within the Service.</li>
                  <li>Scraping or harvesting data from the Service without prior written authorization.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">7. Intellectual Property</h3>
                <p>
                  Sentra retains all rights, title, and interest in the Extension, Service, underlying software,
                  machine-learning models, trademarks, and documentation. These Terms grant you a limited, non-exclusive,
                  revocable license to use the Service; they do not convey any ownership rights.
                </p>
                <p className="mt-2">
                  While you retain ownership of any original manual threat reports you submit, you grant Sentra a perpetual,
                  worldwide, royalty-free license to utilize, modify, and integrate that content into the Service.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">8. Disclaimers &amp; Limitation of Liability</h3>
                <p>
                  THE SERVICE IS PROVIDED STRICTLY ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT EXPRESS
                  OR IMPLIED WARRANTIES OF ANY KIND. Sentra cannot guarantee the detection of every malicious site or phishing
                  attempt, as no security mechanism is entirely infallible. You acknowledge that Sentra is not liable for any
                  direct or indirect damages resulting from your reliance on the Extension.
                </p>
                <p className="mt-2">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTRA&rsquo;S TOTAL CUMULATIVE LIABILITY SHALL NOT EXCEED THE GREATER
                  OF (A) THE TOTAL FEES PAID BY YOU IN THE PRECEDING 12 MONTHS, OR (B) $50 USD.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">9. Indemnification</h3>
                <p>
                  You agree to indemnify, defend, and hold harmless Sentra, its directors, employees, and agents from any claims,
                  damages, liabilities, and expenses (including legal fees) arising from your use of the Service, your breach of
                  these Terms, or your violation of any third-party rights.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">10. Termination</h3>
                <p>
                  We reserve the right to suspend or terminate your access to the Service at our sole discretion, at any time,
                  and without prior notice or liability, particularly in cases of Terms violations.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">11. Changes to These Terms</h3>
                <p>
                  Sentra may modify these Terms periodically. In the event of material changes, we will provide at least 14
                  days&rsquo; notice via email or an in-extension alert before the updates take effect. Continued use of the
                  Service following this period constitutes your acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">12. Governing Law &amp; Dispute Resolution</h3>
                <p>
                  These Terms shall be governed by the laws of the jurisdiction where Sentra is incorporated. Any disputes
                  arising from these Terms will first be addressed through good-faith negotiations. If a resolution cannot be
                  reached, the dispute will be settled through binding arbitration.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">13. Contact</h3>
                <p>For any questions or concerns regarding these Terms, please reach out to us:</p>
                <address className="mt-2 not-italic text-gray-500">
                  Sentra Support Team<br />
                  <span className="text-accent-cyan">cyberlab.dev@gmail.com</span>
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