"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare, Square, ShieldCheck, ArrowUp } from "lucide-react";
import { PrivacyPolicyModal } from "@/components/PrivacyPolicyModal";
import { useLanguage } from "@/components/LanguageProvider";
import { getTermsContent } from "@/lib/legal/terms-content";

export default function TermsPage() {
  const { tr, locale } = useLanguage();
  const content = getTermsContent(locale);
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
            {tr("terms.title")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tr("terms.lastUpdated")}
          </p>
        </div>
      </div>

      {/* Scroll hint */}
      {!hasReadAll && (
        <div className="w-full max-w-3xl mb-3 flex items-center gap-2 text-xs text-accent-cyan/80 bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg px-4 py-2">
          <span className="animate-pulse">&#8595;</span>
          {tr("terms.scrollHint")}
        </div>
      )}

      {/* Terms content */}
      <div
        ref={scrollRef}
        className="glass-panel rounded-2xl w-full max-w-3xl overflow-y-auto"
        style={{ maxHeight: "60vh" }}
      >
        <div className="p-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold mb-2 text-foreground">
                {section.title}
              </h2>
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
            <p>
              {tr("terms.privacyLinkPrefix")}{" "}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-accent-cyan hover:underline"
              >
                {tr("terms.privacyPolicy")}
              </button>
              .
            </p>
            <address className="mt-2 not-italic text-muted-foreground">
              {content.contactTeam}<br />
              <span className="text-accent-cyan">{content.contactEmail}</span>
            </address>
          </section>

          {/* End sentinel */}
          <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border/40">
            {tr("terms.endVersion")}
          </p>
        </div>
      </div>

      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 p-2 rounded-full glass-panel border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={tr("terms.scrollTop")}
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
            {tr("terms.acceptTextPrefix")}{" "}
            <strong>{tr("terms.acceptTextStrong")}</strong> {tr("terms.acceptTextSuffix")}
          </span>
        </label>

        {accepted && (
          <p className="mt-3 text-xs text-accent-cyan/80 flex items-center gap-1.5">
            <ShieldCheck size={13} />
            {tr("terms.acceptedNotice")}
          </p>
        )}
      </div>

      {!hasReadAll && (
        <p className="mt-3 text-xs text-muted-foreground">
          {tr("terms.scrollToEnable")}
        </p>
      )}

      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}