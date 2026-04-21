"use client";

import { useEffect, useState, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { getTermsContent } from "@/lib/legal/terms-content";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const { tr, locale } = useLanguage();
  const content = getTermsContent(locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setShowScrollTop] = useState(false);

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
          className="fixed inset-0 z-50 flex items-center justify-center p-2"
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
            className="rounded-2xl w-full max-w-6xl flex flex-col overflow-hidden bg-card text-foreground h-[98vh]"
            style={{}}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-accent-cyan" size={22} />
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-foreground">{tr("terms.title")}</h2>
                  <p className="text-xs text-muted-foreground">{tr("terms.lastUpdated")}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-colors font-semibold text-sm"
                aria-label="Close"
                title="Close (ESC)"
              >
                <X size={18} />
                <span>{tr("terms.close")}</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm leading-relaxed text-foreground/80"
            >
              {content.sections.map((section) => (
                <section key={section.title}>
                  <h3 className="text-base font-semibold mb-2 text-foreground">{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-2 first:mt-0">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-2 ml-4 space-y-1 list-disc list-outside">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              <section>
                <p>{tr("terms.privacyLinkPrefix")} {tr("terms.privacyPolicy")}.</p>
                <address className="mt-2 not-italic text-muted-foreground">
                  {content.contactTeam}<br />
                  <span className="text-accent-cyan">{content.contactEmail}</span>
                </address>
              </section>

              <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
                {tr("terms.endVersion")}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end">
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}