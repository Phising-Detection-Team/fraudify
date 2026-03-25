
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
                  <p className="text-xs text-gray-500">Sentra &mdash; Last Updated: March 2026</p>
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
              {/* 1 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">1. Introduction</h3>
                <p>
                  Welcome to Sentra (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
                  We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains
                  how we collect, use, disclose, and safeguard your information when you use the Sentra browser extension
                  and associated web services (collectively, the &ldquo;Service&rdquo;).
                </p>
                <p className="mt-2">
                  This Privacy Policy is designed to comply with applicable data protection laws, including relevant
                  United States federal and state privacy laws, and the Socialist Republic of Vietnam&rsquo;s Decree
                  No.&nbsp;13/2023/ND-CP on Personal Data Protection (Decree&nbsp;13).
                </p>
              </section>

              {/* 2 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">2. Information We Collect</h3>
                <p>
                  We collect information that identifies, relates to, or could reasonably be linked to you
                  (&ldquo;Personal Data&rdquo;) in the following ways:
                </p>

                <p className="font-semibold mt-3 mb-1 text-gray-800">A. Information You Provide to Us</p>
                <ul className="ml-4 space-y-1 list-disc list-outside">
                  <li>
                    <strong>Account Information:</strong> When you register for an account, we may collect your email
                    address and a username.
                  </li>
                  <li>
                    <strong>Feedback and Support:</strong> If you contact us for support or submit manual threat reports,
                    we collect the contents of your communications.
                  </li>
                </ul>

                <p className="font-semibold mt-3 mb-1 text-gray-800">B. Information We Collect Automatically</p>
                <p>When you use the Extension, we automatically collect certain information to provide and improve our threat detection:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>
                    <strong>Browsing Data:</strong> To detect phishing, the Extension analyzes URLs of the web pages you
                    visit. We hash or anonymize this data whenever possible before it reaches our servers. We do not
                    collect form inputs, passwords, or the full content of the web pages you visit.
                  </li>
                  <li>
                    <strong>Device and Usage Information:</strong> We collect technical data such as your browser type,
                    operating system version, and extension interaction events (e.g., when a warning is triggered or
                    dismissed).
                  </li>
                </ul>
              </section>

              {/* 3 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">3. How We Use Your Information</h3>
                <p>We use the collected information for the following purposes:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>
                    <strong>Providing the Service:</strong> To operate the Extension, detect malicious links, and display
                    real-time warnings.
                  </li>
                  <li>
                    <strong>Improving the Service:</strong> If you provide explicit consent, we use anonymized URL scan
                    results to train and improve our machine-learning models.
                  </li>
                  <li>
                    <strong>Account Management:</strong> To maintain your account and communicate with you regarding
                    security updates, technical notices, and administrative messages.
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes
                    in the US and Vietnam.
                  </li>
                </ul>
              </section>

              {/* 4 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">4. Data Sharing and Disclosure</h3>
                <p>
                  We do not sell your Personal Data. We may share your information only in the following circumstances:
                </p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>
                    <strong>Service Providers:</strong> We may share data with trusted third-party vendors who assist us
                    in operating our infrastructure (e.g., cloud hosting), subject to strict confidentiality agreements.
                  </li>
                  <li>
                    <strong>Legal Obligations:</strong> We may disclose your information if required to do so by law or
                    in response to valid requests by public authorities (e.g., a court or government agency in the US or
                    Vietnam).
                  </li>
                </ul>
              </section>

              {/* 5 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">5. User Rights and Choices</h3>
                <p>Depending on your location, you have specific rights regarding your Personal Data:</p>

                <p className="font-semibold mt-3 mb-1 text-gray-800">A. US State Privacy Rights</p>
                <p>
                  Residents of certain US states (e.g., California, Virginia, Colorado) may have the right to request
                  access to, correction of, or deletion of their Personal Data, as well as the right to opt-out of
                  certain data processing.
                </p>

                <p className="font-semibold mt-3 mb-1 text-gray-800">B. Vietnam Decree&nbsp;13 Rights</p>
                <p>Under Vietnam&rsquo;s Decree&nbsp;13, users have the right to:</p>
                <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                  <li>Be informed about the processing of their Personal Data.</li>
                  <li>Give, withdraw, or refuse consent for data processing.</li>
                  <li>Access, edit, or request the deletion of their Personal Data.</li>
                  <li>Restrict or object to the processing of their Personal Data.</li>
                </ul>

                <p className="mt-2">
                  To exercise any of these rights, or to withdraw your consent for us to use your anonymized data for
                  machine learning training, please contact us at the email provided below or use the options available
                  in your account settings.
                </p>
              </section>

              {/* 6 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">6. Data Security</h3>
                <p>
                  We implement appropriate technical and organizational measures to protect your Personal Data against
                  unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is
                  entirely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              {/* 7 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">7. Data Retention</h3>
                <p>
                  We retain your Personal Data only for as long as necessary to fulfill the purposes outlined in this
                  Privacy Policy, unless a longer retention period is required or permitted by law. Account data is
                  deleted upon account termination, subject to legal obligations.
                </p>
              </section>

              {/* 8 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">8. Children&rsquo;s Privacy (COPPA Compliance)</h3>
                <p>
                  Our Service is not directed to children under the age of 13. We do not knowingly collect Personal Data
                  from children under 13. If we become aware that we have collected Personal Data from a child under 13
                  without verification of parental consent, we will take steps to remove that information from our
                  servers immediately.
                </p>
              </section>

              {/* 9 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">9. International Data Transfers</h3>
                <p>
                  Sentra operates primarily in the United States and Vietnam. By using the Service, you acknowledge that
                  your information may be transferred to, stored, and processed in countries outside of your country of
                  residence, where data protection laws may differ. We ensure appropriate safeguards are in place to
                  protect your data during such transfers.
                </p>
              </section>

              {/* 10 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">10. Changes to This Privacy Policy</h3>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by
                  posting the new Privacy Policy on this page and updating the &ldquo;Last Updated&rdquo; date. We may
                  also notify you via email or through the Extension.
                </p>
              </section>

              {/* 11 */}
              <section>
                <h3 className="text-base font-semibold mb-2 text-gray-900">11. Contact Us</h3>
                <p>
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
                  please contact us at:
                </p>
                <address className="mt-2 not-italic text-gray-500">
                  Sentra Support Team<br />
                  <span className="text-accent-cyan">cyberlab.dev@gmail.com</span>
                </address>
              </section>

              <p className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
                Privacy Policy &mdash; Last Updated: March 2026
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
