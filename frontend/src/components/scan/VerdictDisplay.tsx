"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldAlert, Copy } from "lucide-react";

interface VerdictDisplayProps {
  verdict: "phishing" | "safe";
  confidence: number;
  reasoning: string[];
  subject: string;
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } } };
const itemVariants = { hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };
const shieldVariants = { hidden: { opacity: 0, scale: 0.5, y: -20 }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 18 } } };
const verdictTextVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.3 } } };

function useCountUp(target: number, duration = 400) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(progress * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

export default function VerdictDisplay({
  verdict,
  confidence,
  reasoning,
  subject,
}: VerdictDisplayProps) {
  const isPhishing = verdict === "phishing";
  const confidencePercent = Math.round(confidence * 100);
  const countedPercent = useCountUp(confidencePercent);
  const arcColor = isPhishing ? "stroke-accent-red" : "stroke-accent-cyan";
  const textColor = isPhishing ? "text-accent-red" : "text-accent-cyan";
  const meterGradient = isPhishing
    ? "from-accent-red to-accent-orange"
    : "from-accent-cyan to-accent-purple";

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const handleCopy = () => {
    navigator.clipboard.writeText(reasoning.join("\n"));
  };

  return (
    <AnimatePresence>
      <motion.div
        className="glass-panel rounded-xl p-6 space-y-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-xs text-muted-foreground truncate">
          {subject}
        </p>

        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center w-36 h-36">
            <svg
              width="144"
              height="144"
              viewBox="0 0 144 144"
              className="-rotate-90 absolute"
            >
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-border/30"
              />
              <motion.circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                className={arcColor}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: confidence }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ strokeDashoffset: 0 }}
              />
            </svg>

            <div className="flex flex-col items-center z-10">
              <motion.div variants={shieldVariants} initial="hidden" animate="visible">
                {isPhishing ? (
                  <ShieldAlert size={28} className={textColor} data-testid="shield-alert-icon" />
                ) : (
                  <Shield size={28} className={textColor} data-testid="shield-icon" />
                )}
              </motion.div>

              <motion.span
                data-testid="confidence-display"
                data-confidence={confidencePercent}
                className={`text-2xl font-bold tabular-nums ${textColor}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {`${countedPercent}%`}
              </motion.span>
            </div>
          </div>

          <motion.p
            className={`text-2xl font-extrabold tracking-widest uppercase ${textColor}`}
            variants={verdictTextVariants}
            initial="hidden"
            animate="visible"
          >
            {verdict === "phishing" ? "PHISHING" : "SAFE"}
          </motion.p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Threat Level
          </p>
          <div className="h-2.5 bg-background/50 rounded-full overflow-hidden">
            <motion.div
              data-testid="threat-meter"
              className={`h-full rounded-full bg-gradient-to-r ${meterGradient}`}
              initial={{ width: "0%" }}
              animate={{ width: `${confidencePercent}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {reasoning.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Reasoning
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50 hover:bg-muted/30"
                aria-label="Copy reasoning"
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
            <motion.ul
              className="space-y-1.5"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {reasoning.map((point, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                  variants={itemVariants}
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current ${textColor}`} />
                  {point}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
