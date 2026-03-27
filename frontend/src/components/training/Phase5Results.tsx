"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Trophy, Play, RotateCcw, CheckCircle2, ExternalLink } from "lucide-react";
import { SentraMascot } from "./SentraMascot";

interface PhaseProps { autoPlay: boolean; phaseProgress: number; wasCompleted?: boolean; onComplete?: () => void; }

const METRICS = [
  { label: "Accuracy",  value: 97.30, unit: "%",  color: "accent-cyan",   ring: 273 },
  { label: "F1 Score",  value: 97.28, unit: "",   color: "accent-purple", ring: 272 },
  { label: "Precision", value: 97.35, unit: "",   color: "accent-green",  ring: 273 },
  { label: "Recall",    value: 97.21, unit: "",   color: "accent-cyan",   ring: 272 },
];

// Confusion matrix with ~500 samples @ 97.3% accuracy
const CONF_MATRIX = {
  tp: 233, // phishing → phishing
  fp:   7, // legitimate → phishing
  fn:   6, // phishing → legitimate
  tn: 254, // legitimate → legitimate
};

function useSlotCounter(target: number, durationMs: number, active: boolean, decimals = 2) {
  const [display, setDisplay] = useState("0.00");
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const p    = Math.min((now - t0) / durationMs, 1);
      const ease = 1 - Math.pow(1 - p, 4);

      // Slot machine: random numbers until last 30% of animation
      if (ease < 0.7) {
        const rand = (Math.random() * target * 1.1).toFixed(decimals);
        setDisplay(rand);
      } else {
        const val = (ease * target).toFixed(decimals);
        setDisplay(val);
      }
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target.toFixed(decimals));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs, decimals]);
  return display;
}

function RadialRing({ value, color, size = 96 }: { value: number; color: string; size?: number }) {
  const r   = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = value / 100;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={`hsl(var(--${color}))`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 2.2, ease: "easeOut", delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 4px hsl(var(--${color})/0.5))` }}
      />
    </svg>
  );
}

export function Phase5Results({ autoPlay, wasCompleted, onComplete }: PhaseProps) {
  const [stage, setStage]         = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [countActive, setCount]   = useState(false);
  const [deployProgress, setDeploy] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const deployRaf = useRef<number>(0);

  const acc  = useSlotCounter(97.30, 2500, countActive, 2);
  const f1   = useSlotCounter(0.9728, 2500, countActive, 4);
  const prec = useSlotCounter(0.9735, 2500, countActive, 4);
  const rec  = useSlotCounter(0.9721, 2500, countActive, 4);

  const displays = [acc, f1, prec, rec];

  const startPlay = () => {
    timers.current.forEach(clearTimeout);
    cancelAnimationFrame(deployRaf.current);
    setStage(0); setCount(false); setDeploy(0); setPlaying(true);

    timers.current.push(setTimeout(() => { setStage(1); setCount(true); }, 400));
    timers.current.push(setTimeout(() => setStage(2), 3200));
    timers.current.push(setTimeout(() => {
      setStage(3);
      // Animate deploy progress bar
      const t0 = performance.now();
      const dur = 4000;
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        setDeploy(Math.round(p * 100));
        if (p < 1) deployRaf.current = requestAnimationFrame(tick);
        else onComplete?.();
      };
      deployRaf.current = requestAnimationFrame(tick);
    }, 6500));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    cancelAnimationFrame(deployRaf.current);
    setStage(0); setCount(false); setDeploy(0); setPlaying(false);
  };

  useEffect(() => {
    if (wasCompleted) {
      setStage(3); setCount(true); setDeploy(100); setPlaying(true);
    } else if (autoPlay) {
      startPlay();
    }
    return () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(deployRaf.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, wasCompleted]);

  return (
    <div className="space-y-6">
      {/* Sentra Mascot */}
      <SentraMascot phase={5} active={stage >= 1} instant={wasCompleted} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Rocket size={20} className="text-accent-green" />
            Results &amp; Deployment
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluation on held-out test set, confusion matrix, and push to HuggingFace Hub
          </p>
        </div>
        <div className="flex gap-2">
          {playing && <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:bg-muted transition-colors"><RotateCcw size={12} /> Reset</button>}
          {!playing && <button onClick={startPlay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10 transition-colors"><Play size={12} /> Play Phase</button>}
        </div>
      </div>

      {/* Metric cards */}
      <AnimatePresence>
        {stage >= 1 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className="glass-panel rounded-xl p-5 flex flex-col items-center text-center relative overflow-hidden group"
              >
                <div className={`absolute inset-0 bg-${m.color}/5 opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className="relative mb-2">
                  <RadialRing value={m.value > 1 ? m.value : m.value * 100} color={m.color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Trophy size={14} className={`text-${m.color}`} />
                  </div>
                </div>

                <div className={`text-2xl font-bold font-mono tabular-nums text-${m.color}`}>
                  {displays[i]}{m.unit}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold">{m.label}</div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion matrix */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel rounded-xl p-5"
            >
              <h3 className="font-semibold text-sm mb-4">Confusion Matrix  (500 test samples)</h3>

              <div className="flex gap-3">
                {/* Matrix grid */}
                <div className="flex-1">
                  {/* Header */}
                  <div className="grid grid-cols-2 gap-1 mb-1">
                    <div className="text-[10px] text-center text-muted-foreground font-semibold col-span-2 mb-1">Predicted →</div>
                    <div className="text-[10px] text-center text-muted-foreground">Legitimate</div>
                    <div className="text-[10px] text-center text-muted-foreground">Phishing</div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: "TN", count: CONF_MATRIX.tn, bg: "bg-accent-green/20", border: "border-accent-green/40", text: "text-accent-green",  title: "True Negative",  desc: "Legitimate → Legitimate" },
                      { label: "FP", count: CONF_MATRIX.fp, bg: "bg-accent-red/10",   border: "border-accent-red/30",   text: "text-accent-red",    title: "False Positive", desc: "Legitimate → Phishing"  },
                      { label: "FN", count: CONF_MATRIX.fn, bg: "bg-accent-red/10",   border: "border-accent-red/30",   text: "text-accent-red",    title: "False Negative", desc: "Phishing → Legitimate"  },
                      { label: "TP", count: CONF_MATRIX.tp, bg: "bg-accent-green/20", border: "border-accent-green/40", text: "text-accent-green",  title: "True Positive",  desc: "Phishing → Phishing"    },
                    ].map((cell, i) => (
                      <motion.div
                        key={cell.label}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.15 }}
                        className={`${cell.bg} border ${cell.border} rounded-lg p-3 text-center group relative cursor-default`}
                        title={cell.desc}
                      >
                        <div className={`text-xs font-bold mb-1 ${cell.text}`}>{cell.label}</div>
                        <div className={`text-2xl font-bold font-mono ${cell.text}`}>{cell.count}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{cell.title}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Row label */}
                  <div className="mt-2 text-[10px] text-center text-muted-foreground">
                    ↑ Actual
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-accent-green/5 border border-accent-green/20 text-center">
                  <div className="text-muted-foreground">Correct</div>
                  <div className="font-bold text-accent-green">{CONF_MATRIX.tp + CONF_MATRIX.tn} / 500</div>
                </div>
                <div className="p-2 rounded bg-accent-red/5 border border-accent-red/20 text-center">
                  <div className="text-muted-foreground">Misclassified</div>
                  <div className="font-bold text-accent-red">{CONF_MATRIX.fp + CONF_MATRIX.fn} / 500</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HuggingFace deploy */}
        <AnimatePresence>
          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel rounded-xl p-5 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <Rocket size={16} className="text-accent-purple" />
                <h3 className="font-semibold text-sm">Pushed to HuggingFace Hub</h3>
              </div>

              {/* Upload progress */}
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Uploading model weights...</span>
                  <span className="font-mono text-accent-purple">{deployProgress}%</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
                    animate={{ width: `${deployProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>

              {deployProgress >= 100 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3 flex-1"
                >
                  <div className="flex items-center gap-2 text-accent-green text-sm font-semibold">
                    <CheckCircle2 size={16} />
                    Upload complete!
                  </div>

                  {/* Model card */}
                  <div className="p-4 rounded-xl border border-accent-purple/30 bg-accent-purple/5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Model</div>
                        <div className="font-mono font-bold text-sm">sentra-utoledo-v1.0</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold shrink-0">
                        Private
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base model</span>
                        <span className="font-mono">distilbert v2.4.1</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Task</span>
                        <span className="font-mono">text-classification</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Labels</span>
                        <span className="font-mono">legitimate · phishing</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Best F1</span>
                        <span className="font-mono font-bold text-accent-green">0.9730</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <a
                        href="https://huggingface.co/sentra-utoledo/sentra-utoledo-v1.0"
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                      >
                        View on HuggingFace
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Final celebration */}
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-3 rounded-lg bg-gradient-to-r from-accent-cyan/10 to-accent-purple/10 border border-accent-cyan/20 text-center"
                  >
                    <p className="text-xs font-semibold neon-text">
                      Sentra is production-ready 🚀
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      66M params · 0.9% trainable · 97.3% accuracy
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
