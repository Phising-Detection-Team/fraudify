"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Play, RotateCcw, Terminal, Mail, ShieldAlert, TrendingDown } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { SentraMascot } from "./SentraMascot";

interface PhaseProps { autoPlay: boolean; phaseProgress: number; wasCompleted?: boolean; onComplete?: () => void; }

function makeLossData() {
  const pts: { step: number; loss: number; lr: number; epoch: number }[] = [];
  const totalSteps   = 7500;
  const stepsPerEpoch = 2500;

  for (let s = 0; s <= totalSteps; s += 50) {
    const warmup   = Math.min(s / 225, 1);
    const cosDecay = 0.5 * (1 + Math.cos(Math.PI * s / totalSteps));
    const lr       = warmup * 2e-4 * cosDecay;
    const baseDecay = 1.82 * Math.exp(-s / 1800);
    const noise     = (Math.random() - 0.5) * 0.018;
    const loss      = Math.max(0.17, baseDecay + 0.18 + noise);
    // FIX: cap epoch at 3
    pts.push({ step: s, loss: +loss.toFixed(4), lr: +lr.toFixed(6), epoch: Math.min(Math.floor(s / stepsPerEpoch) + 1, 3) });
  }
  return pts;
}

const FULL_DATA = makeLossData();

const EPOCH_MILESTONES = [
  { step: 2500, epoch: 1, f1: "0.441", loss: "0.893" },
  { step: 5000, epoch: 2, f1: "0.289", loss: "0.451" },
  { step: 7500, epoch: 3, f1: "0.188", loss: "0.220" },
];

// 16 mini email samples for batch visualization (8 phishing, 8 legitimate)
const BATCH_EMAILS = [
  { label: "phishing",   snippet: "Urgent: verify now" },
  { label: "legitimate", snippet: "Team standup at 3pm" },
  { label: "phishing",   snippet: "You won $500!" },
  { label: "legitimate", snippet: "Q3 report attached" },
  { label: "phishing",   snippet: "Click to claim prize" },
  { label: "legitimate", snippet: "PR review requested" },
  { label: "phishing",   snippet: "Account suspended!" },
  { label: "legitimate", snippet: "Lunch order today?" },
  { label: "phishing",   snippet: "Login from new IP" },
  { label: "legitimate", snippet: "Invoice #2024-087" },
  { label: "phishing",   snippet: "Password expiring" },
  { label: "legitimate", snippet: "Deployment succeeded" },
  { label: "phishing",   snippet: "Free gift card link" },
  { label: "legitimate", snippet: "Budget approved ✓" },
  { label: "phishing",   snippet: "Bank alert: act now" },
  { label: "legitimate", snippet: "Welcome to the team" },
] as const;

const LOG_LINES = [
  "Loading SFT dataset — instruction-response pairs (packing=True)...",
  "🦥 Unsloth: Fused kernels loaded — 2.3× faster than standard TRL",
  "Initializing SFTTrainer (Unsloth) — Epoch 1/3",
  "Step   50 | loss: 2.1843 | lr: 1.78e-05",
  "Step  100 | loss: 1.7652 | lr: 3.56e-05",
  "Step  200 | loss: 1.3291 | lr: 7.11e-05",
  "Step  500 | loss: 0.9134 | lr: 1.78e-04",
  "Evaluation @ step 500 | eval_loss: 0.8741",
  "Step  750 | loss: 0.7823 | lr: 1.74e-04",
  "Step 1000 | loss: 0.6541 | lr: 1.71e-04",
  "--- Epoch 1 complete | avg_loss: 0.8932 ---",
  "Initializing SFTTrainer (Unsloth) — Epoch 2/3",
  "Step 1250 | loss: 0.5432 | lr: 1.65e-04",
  "Step 1500 | loss: 0.4721 | lr: 1.57e-04",
  "Evaluation @ step 1500 | eval_loss: 0.4412",
  "Step 1750 | loss: 0.4013 | lr: 1.48e-04",
  "Step 2000 | loss: 0.3654 | lr: 1.38e-04",
  "--- Epoch 2 complete | avg_loss: 0.4512 ---",
  "Initializing SFTTrainer (Unsloth) — Epoch 3/3",
  "Step 2250 | loss: 0.3121 | lr: 1.28e-04",
  "Step 2500 | loss: 0.2743 | lr: 1.17e-04",
  "Evaluation @ step 2500 | eval_loss: 0.2891",
  "Step 2750 | loss: 0.2534 | lr: 1.05e-04",
  "Step 3000 | loss: 0.2312 | lr: 9.28e-05",
  "Step 3500 | loss: 0.2098 | lr: 6.67e-05",
  "Step 4000 | loss: 0.1934 | lr: 4.44e-05",
  "Evaluation @ step 4000 | eval_loss: 0.1876 ← Best model saved",
  "--- Epoch 3 complete | avg_loss: 0.2201 ---",
  "Training complete. Best eval_loss: 0.1876",
  "Saving model checkpoint...",
  "Pushing to HuggingFace Hub...",
  "✓ sentra-utoledo/sentra-utoledo-v2.0 uploaded successfully",
];

// ── Gradient Descent Landscape ──────────────────────────────
// Loss surface: f(x) = 2.5*(x-0.72)^2 + 0.08 + 0.035*sin(16*x)
function lossAt(x: number): number {
  return 2.5 * Math.pow(x - 0.72, 2) + 0.08 + 0.035 * Math.sin(16 * x);
}

const LANDSCAPE_W = 320;
const LANDSCAPE_H = 130;
const X_MIN = 0.0;
const X_MAX = 1.4;

function xToSvg(x: number) { return ((x - X_MIN) / (X_MAX - X_MIN)) * LANDSCAPE_W; }
function yToSvg(y: number) { return LANDSCAPE_H - Math.min(y / 1.2, 1) * LANDSCAPE_H; }

// Build the SVG path for the loss landscape
const LANDSCAPE_PATH = (() => {
  const steps = 200;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = X_MIN + (i / steps) * (X_MAX - X_MIN);
    const y = lossAt(x);
    const sx = xToSvg(x);
    const sy = yToSvg(y);
    d += i === 0 ? `M ${sx} ${sy}` : ` L ${sx} ${sy}`;
  }
  return d;
})();

// Ball trajectories for 3 learning rate scenarios
type Trajectory = { x: number; y: number }[];

function sgdTrajectory(): Trajectory {
  const pts: Trajectory = [];
  let x = 0.1;
  for (let i = 0; i < 40; i++) {
    pts.push({ x: xToSvg(x), y: yToSvg(lossAt(x)) });
    const grad = 5 * (x - 0.72) + 0.56 * Math.cos(16 * x) + (Math.random() - 0.5) * 0.18;
    x -= 0.055 * grad;
    x = Math.max(X_MIN + 0.01, Math.min(X_MAX - 0.01, x));
  }
  return pts;
}

function highLrTrajectory(): Trajectory {
  const pts: Trajectory = [];
  let x = 0.1;
  for (let i = 0; i < 25; i++) {
    pts.push({ x: xToSvg(x), y: yToSvg(lossAt(x)) });
    const grad = 5 * (x - 0.72) + 0.56 * Math.cos(16 * x);
    x -= 0.28 * grad;
    x = Math.max(X_MIN + 0.01, Math.min(X_MAX - 0.01, x));
  }
  return pts;
}

function adamwTrajectory(): Trajectory {
  const pts: Trajectory = [];
  let x = 0.1;
  let m = 0; let v = 0;
  for (let i = 0; i < 35; i++) {
    pts.push({ x: xToSvg(x), y: yToSvg(lossAt(x)) });
    const grad = 5 * (x - 0.72) + 0.56 * Math.cos(16 * x) + 0.01 * x;
    m = 0.9 * m + 0.1 * grad;
    v = 0.999 * v + 0.001 * grad * grad;
    const mHat = m / (1 - Math.pow(0.9, i + 1));
    const vHat = v / (1 - Math.pow(0.999, i + 1));
    x -= 0.07 * (mHat / (Math.sqrt(vHat) + 1e-8) + 0.01 * x);
    x = Math.max(X_MIN + 0.01, Math.min(X_MAX - 0.01, x));
  }
  return pts;
}

const SGD_TRAJ    = sgdTrajectory();
const HIGHLR_TRAJ = highLrTrajectory();
const ADAMW_TRAJ  = adamwTrajectory();

function trajectoryPath(traj: Trajectory) {
  return traj.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function GradientDescentLandscape({ active }: { active: boolean }) {
  const [mode, setMode] = useState<"sgd" | "high_lr" | "adamw">("high_lr");
  const [ballStep, setBallStep] = useState(0);
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const traj     = mode === "sgd" ? SGD_TRAJ : mode === "high_lr" ? HIGHLR_TRAJ : ADAMW_TRAJ;
  const ballPos  = traj[Math.min(ballStep, traj.length - 1)];

  useEffect(() => {
    if (!active) return;
    setBallStep(0);
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = setInterval(() => {
      setBallStep(prev => {
        if (prev >= traj.length - 1) { clearInterval(intRef.current!); return prev; }
        return prev + 1;
      });
    }, 90);
    return () => { if (intRef.current) clearInterval(intRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode]);

  const modeConfig = {
    high_lr:  { label: "Too-High LR",    color: "#ef4444", desc: "Overshoots minimum — diverges or oscillates wildly" },
    sgd:      { label: "SGD (no momentum)", color: "#f59e0b", desc: "Slow, noisy — gets stuck in local minima" },
    adamw:    { label: "AdamW (ours)",    color: "#22d3ee", desc: "Momentum + adaptive LR — smooth convergence ✓" },
  };
  const cfg = modeConfig[mode];

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingDown size={15} className="text-accent-green" />
        <h3 className="font-semibold text-sm">Loss Landscape — Gradient Descent Visualization</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        The optimizer must navigate a rugged loss surface to find the global minimum. Different strategies lead to very different convergence behavior.
      </p>

      {/* Mode selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["high_lr", "sgd", "adamw"] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setBallStep(0); }}
            className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
              mode === m
                ? m === "adamw"
                  ? "bg-accent-cyan/20 border-accent-cyan/50 text-accent-cyan"
                  : m === "sgd"
                  ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                  : "bg-red-500/20 border-red-500/50 text-red-400"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {modeConfig[m].label}
          </button>
        ))}
      </div>

      {/* SVG Loss Landscape */}
      <div className="relative rounded-lg overflow-hidden bg-[#060a0d] border border-border/30 mb-3">
        <svg viewBox={`0 0 ${LANDSCAPE_W} ${LANDSCAPE_H}`} className="w-full" style={{ height: 150 }}>
          {/* Gradient fill under curve */}
          <defs>
            <linearGradient id="surfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(0,100,180,0.35)" />
              <stop offset="100%" stopColor="rgba(0,30,60,0.1)" />
            </linearGradient>
            <filter id="ballGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Area under curve */}
          <path d={`${LANDSCAPE_PATH} L ${LANDSCAPE_W} ${LANDSCAPE_H} L 0 ${LANDSCAPE_H} Z`} fill="url(#surfGrad)" />

          {/* Loss curve */}
          <path d={LANDSCAPE_PATH} fill="none" stroke="rgba(100,180,255,0.6)" strokeWidth="1.5" />

          {/* Global minimum marker */}
          <line x1={xToSvg(0.72)} y1={0} x2={xToSvg(0.72)} y2={LANDSCAPE_H}
            stroke="rgba(0,200,100,0.25)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={xToSvg(0.72)} cy={yToSvg(lossAt(0.72))} r="4"
            fill="rgba(0,200,100,0.3)" stroke="rgba(0,200,100,0.7)" strokeWidth="1.2" />
          <text x={xToSvg(0.72) + 5} y={yToSvg(lossAt(0.72)) - 6}
            fontSize="7" fill="rgba(0,200,100,0.8)" fontWeight="700">global min</text>

          {/* Trajectory path (faded) */}
          <AnimatePresence>
            <motion.path
              key={mode}
              d={trajectoryPath(traj.slice(0, ballStep + 1))}
              fill="none"
              stroke={cfg.color}
              strokeWidth="1.5"
              strokeOpacity="0.5"
              strokeDasharray="3 2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.1 }}
            />
          </AnimatePresence>

          {/* Ball */}
          {ballPos && (
            <circle
              cx={ballPos.x} cy={ballPos.y} r="5"
              fill={cfg.color}
              filter="url(#ballGlow)"
              style={{ transition: "cx 0.08s linear, cy 0.08s linear" }}
            />
          )}

          {/* Axis labels */}
          <text x="5" y={LANDSCAPE_H - 4} fontSize="7" fill="rgba(150,150,150,0.5)">parameter θ →</text>
          <text x="5" y="10" fontSize="7" fill="rgba(150,150,150,0.5)">loss ↑</text>
        </svg>
      </div>

      <div className={`text-xs px-3 py-2 rounded-lg border ${
        mode === "adamw" ? "bg-accent-cyan/5 border-accent-cyan/20 text-accent-cyan"
        : mode === "sgd"  ? "bg-amber-400/5 border-amber-400/20 text-amber-300"
        : "bg-red-500/5 border-red-500/20 text-red-400"
      }`}>
        <span className="font-bold">{cfg.label}: </span>{cfg.desc}
      </div>

      {/* AdamW insight */}
      {mode === "adamw" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"
        >
          {[
            { label: "Momentum", val: "β₁=0.9", note: "smooths gradient noise", color: "text-amber-400" },
            { label: "Adaptive LR", val: "β₂=0.999", note: "scales per-param", color: "text-accent-purple" },
            { label: "Weight Decay", val: "λ=0.01", note: "prevents overfitting", color: "text-accent-green" },
          ].map(i => (
            <div key={i.label} className="p-2 rounded bg-muted/20 border border-border/30">
              <div className={`font-bold font-mono ${i.color}`}>{i.val}</div>
              <div className="text-muted-foreground mt-0.5">{i.note}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// AdamW moment animation hook
function useMomentValues(active: boolean) {
  const [m, setM] = useState(0);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let step = 0;
    const int = setInterval(() => {
      step++;
      // Simulate m_t and v_t converging
      setM(0.9 * (1 - Math.exp(-step / 8)));
      setV(0.999 * (1 - Math.exp(-step / 80)));
    }, 120);
    return () => clearInterval(int);
  }, [active]);
  return { m, v };
}

export function Phase4Training({ autoPlay, wasCompleted, onComplete }: PhaseProps) {
  const [stage, setStage]         = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [visibleData, setVData]   = useState<typeof FULL_DATA>([]);
  const [logLines, setLogLines]   = useState<string[]>([]);
  const [currentStep, setStep]    = useState(0);
  const [currentEpoch, setEpoch]  = useState(1);
  const [loopActive, setLoop]     = useState(false);
  const [dotPos, setDotPos]       = useState({ x: 90, y: 35 });
  const [batchActive, setBatch]   = useState(false);
  const [activeBatch, setActiveBatch] = useState<number[]>([]);
  const [completedEpochs, setCompletedEpochs] = useState<number[]>([]);

  const logRef   = useRef<HTMLDivElement>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dataRaf  = useRef<number>(0);
  const dotRaf   = useRef<number>(0);
  const angleRef = useRef<number>(-Math.PI / 2);

  const { m: adamM, v: adamV } = useMomentValues(batchActive);

  const startPlay = () => {
    timers.current.forEach(clearTimeout);
    cancelAnimationFrame(dataRaf.current);
    cancelAnimationFrame(dotRaf.current);
    setStage(0); setVData([]); setLogLines([]); setStep(0); setEpoch(1);
    setLoop(false); setPlaying(true); setBatch(false); setActiveBatch([]); setCompletedEpochs([]);

    timers.current.push(setTimeout(() => {
      setStage(1);
      setLoop(true);
      angleRef.current = -Math.PI / 2;
      const orbitTick = () => {
        angleRef.current += 0.018;
        setDotPos({
          x: 90 + 72 * Math.cos(angleRef.current),
          y: 90 + 55 * Math.sin(angleRef.current),
        });
        dotRaf.current = requestAnimationFrame(orbitTick);
      };
      dotRaf.current = requestAnimationFrame(orbitTick);
    }, 400));

    timers.current.push(setTimeout(() => setStage(2), 2000));

    // Animate loss curve
    const curveStart = performance.now() + 2000;
    const duration   = 10000;
    const animateCurve = (now: number) => {
      const t   = Math.min((now - curveStart) / duration, 1);
      const idx = Math.floor(t * FULL_DATA.length);
      setVData(FULL_DATA.slice(0, Math.max(idx, 1)));
      const latestPt = FULL_DATA[Math.max(idx - 1, 0)];
      if (latestPt) {
        setStep(latestPt.step);
        setEpoch(latestPt.epoch);
        // Mark epoch completions
        EPOCH_MILESTONES.forEach(m => {
          if (latestPt.step >= m.step) {
            setCompletedEpochs(prev => prev.includes(m.epoch) ? prev : [...prev, m.epoch]);
          }
        });
      }
      if (t < 1) dataRaf.current = requestAnimationFrame(animateCurve);
      else { setStage(4); onComplete?.(); }
    };
    timers.current.push(
      setTimeout(() => { dataRaf.current = requestAnimationFrame(animateCurve); }, 2000)
    );

    // Batch + optimizer section at stage 3
    timers.current.push(setTimeout(() => { setStage(3); setBatch(true); }, 7500));

    // Animate batch highlights
    let batchIdx = 0;
    const batchLoop = () => {
      setActiveBatch(Array.from({ length: 8 }, (_, k) => (batchIdx * 8 + k) % 16));
      batchIdx++;
      timers.current.push(setTimeout(batchLoop, 800));
    };
    timers.current.push(setTimeout(batchLoop, 7700));

    // Stream log lines
    LOG_LINES.forEach((line, i) => {
      timers.current.push(
        setTimeout(() => {
          setLogLines(prev => [...prev, line]);
        }, 2200 + i * 390)
      );
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    cancelAnimationFrame(dataRaf.current);
    cancelAnimationFrame(dotRaf.current);
    setStage(0); setVData([]); setLogLines([]); setStep(0); setEpoch(1);
    setLoop(false); setPlaying(false); setBatch(false); setActiveBatch([]); setCompletedEpochs([]);
    setDotPos({ x: 90, y: 35 });
  };

  useEffect(() => {
    if (wasCompleted) {
      setStage(4); setVData(FULL_DATA); setLogLines(LOG_LINES);
      setStep(7500); setEpoch(3); setBatch(true); setPlaying(true);
      setCompletedEpochs([1, 2, 3]);
    } else if (autoPlay) {
      startPlay();
    }
    return () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(dataRaf.current);
      cancelAnimationFrame(dotRaf.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, wasCompleted]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const CONFIG_PILLS = [
    { label: "Epochs: 3",               color: "text-accent-cyan"      },
    { label: "Batch: 16",               color: "text-accent-purple"    },
    { label: "LR: 2e-4",               color: "text-accent-cyan"      },
    { label: "Scheduler: cosine",        color: "text-accent-green"     },
    { label: "Optimizer: paged_adamw",   color: "text-accent-red"       },
    { label: "Warmup: 3%",              color: "text-muted-foreground" },
    { label: "Weight decay: 0.01",       color: "text-muted-foreground" },
    { label: "Max grad norm: 0.3",       color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Sentra Mascot */}
      <SentraMascot phase={4} active={stage >= 1} instant={wasCompleted} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw size={20} className="text-accent-green" />
            Training Loop
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            3 epochs · ~7,500 steps · cosine LR decay · best model by eval_loss
          </p>
        </div>
        <div className="flex gap-2">
          {playing && <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:bg-muted transition-colors"><RotateCcw size={12} /> Reset</button>}
          {!playing && <button onClick={startPlay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-accent-green/40 bg-accent-green/5 text-accent-green hover:bg-accent-green/10 transition-colors"><Play size={12} /> Play Phase</button>}
        </div>
      </div>

      {/* Config pills */}
      <div className="flex flex-wrap gap-2">
        {CONFIG_PILLS.map((p, i) => (
          <motion.span
            key={p.label}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className={`text-xs px-2.5 py-1 rounded-full border border-border/50 bg-background/50 font-mono ${p.color}`}
          >
            {p.label}
          </motion.span>
        ))}
      </div>

      {/* Loop diagram + Loss curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loop diagram */}
        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-xl p-5 flex flex-col"
            >
              <h3 className="font-semibold text-sm mb-3">Training Loop</h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/20">
                  <div className="text-xs text-muted-foreground mb-0.5">Epoch</div>
                  <div className="text-2xl font-bold font-mono text-accent-cyan">{currentEpoch}/3</div>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-accent-purple/5 border border-accent-purple/20">
                  <div className="text-xs text-muted-foreground mb-0.5">Step</div>
                  <div className="text-2xl font-bold font-mono text-accent-purple">{currentStep.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <svg viewBox="0 0 180 180" className="w-full max-w-[180px]">
                  <ellipse cx="90" cy="90" rx="72" ry="55" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 3" />

                  {loopActive && (
                    <circle
                      cx={dotPos.x}
                      cy={dotPos.y}
                      r="5"
                      fill="hsl(var(--accent-cyan))"
                      style={{ filter: "drop-shadow(0 0 5px hsl(var(--accent-cyan)))" }}
                    />
                  )}

                  {[
                    { label: "Batch",    sub: "×16",      x: 90,  y: 20,  c: "accent-cyan"   },
                    { label: "Forward",  sub: "pass",     x: 162, y: 68,  c: "accent-purple" },
                    { label: "Loss",     sub: "CE",       x: 140, y: 148, c: "accent-red"    },
                    { label: "Backward", sub: "∇A,B",     x: 40,  y: 148, c: "accent-red"    },
                    { label: "AdamW",    sub: "update",   x: 18,  y: 68,  c: "accent-green"  },
                  ].map((node, i) => (
                    <g key={node.label}>
                      <motion.circle
                        cx={node.x} cy={node.y} r="13"
                        fill={`rgba(0,0,0,0.0)`}
                        stroke={`hsl(var(--${node.c}))`}
                        strokeWidth="1.5"
                        style={{ fill: `hsl(var(--${node.c})/0.12)` }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.15 }}
                      />
                      <text x={node.x} y={node.y - 2} textAnchor="middle" dominantBaseline="middle" fontSize="5.5" fontWeight="700" fill={`hsl(var(--${node.c}))`}>
                        {node.label}
                      </text>
                      <text x={node.x} y={node.y + 6} textAnchor="middle" dominantBaseline="middle" fontSize="4.5" fill={`hsl(var(--${node.c}))`} opacity="0.7">
                        {node.sub}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loss curve */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-xl p-5 lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Training Loss  (3 epochs · 7,500 steps)</h3>
                {/* Epoch milestone badges */}
                <div className="flex gap-1.5">
                  {EPOCH_MILESTONES.map(m => (
                    <AnimatePresence key={m.epoch}>
                      {completedEpochs.includes(m.epoch) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-accent-green/15 border border-accent-green/30 text-accent-green font-semibold font-mono"
                        >
                          E{m.epoch} loss:{m.f1}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={visibleData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--accent-cyan))"  stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(var(--accent-cyan))"  stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                    <XAxis dataKey="step" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} domain={[0, 0.7]} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => [Number(v).toFixed(4), "Loss"]}
                    />
                    <ReferenceLine x={2500} stroke="hsl(var(--border))" strokeDasharray="4 3" label={{ value: "Epoch 1", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <ReferenceLine x={5000} stroke="hsl(var(--border))" strokeDasharray="4 3" label={{ value: "Epoch 2", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                    <Area
                      type="monotone" dataKey="loss"
                      stroke="hsl(var(--accent-cyan))" strokeWidth={2}
                      fill="url(#lossGrad)"
                      dot={false} isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal log */}
      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-card/50">
              <Terminal size={14} className="text-accent-green" />
              <span className="text-xs font-semibold text-accent-green">Training Output</span>
              <div className="flex gap-1 ml-auto">
                {["bg-accent-red","bg-amber-400","bg-accent-green"].map(c => (
                  <div key={c} className={`w-2.5 h-2.5 rounded-full ${c} opacity-60`} />
                ))}
              </div>
            </div>
            <div
              ref={logRef}
              className="p-4 font-mono text-xs text-accent-green/80 bg-[#0a0f0a] h-[160px] overflow-y-auto leading-relaxed"
            >
              {logLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={line.startsWith("---") ? "text-accent-cyan font-bold" : line.startsWith("✓") ? "text-accent-green font-bold" : ""}
                >
                  <span className="text-muted-foreground/40 mr-2 select-none">&gt;</span>
                  {line}
                </motion.div>
              ))}
              {logLines.length > 0 && logLines.length < LOG_LINES.length && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                  className="inline-block w-2 h-3 bg-accent-green/70 ml-1"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 3: Gradient Descent Landscape ── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GradientDescentLandscape active={stage >= 3} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 3: Batch Visualization + AdamW Optimizer ── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Batch Visualization */}
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Mail size={15} className="text-accent-cyan" />
                <h3 className="font-semibold text-sm">Mini-Batch  —  16 Samples per Step</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Each training step picks 16 random emails from ~40K. Mixed phishing &amp; legitimate.
              </p>

              {/* 4×4 email grid */}
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {BATCH_EMAILS.map((email, i) => (
                  <motion.div
                    key={i}
                    className={`relative rounded p-1.5 border text-[8px] leading-tight transition-all duration-300 ${
                      activeBatch.includes(i)
                        ? email.label === "phishing"
                          ? "bg-red-500/20 border-red-500/50 text-red-300"
                          : "bg-accent-green/20 border-accent-green/50 text-accent-green"
                        : "bg-muted/20 border-border/30 text-muted-foreground/50"
                    }`}
                    animate={activeBatch.includes(i) ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-0.5 mb-0.5">
                      {email.label === "phishing"
                        ? <ShieldAlert size={7} className="text-red-400 shrink-0" />
                        : <Mail size={7} className="text-accent-green shrink-0" />
                      }
                      <span className={`font-bold font-mono text-[7px] ${email.label === "phishing" ? "text-red-400" : "text-accent-green"}`}>
                        {email.label === "phishing" ? "PHISH" : "LEGIT"}
                      </span>
                    </div>
                    <div className="truncate opacity-70">{email.snippet}</div>
                  </motion.div>
                ))}
              </div>

              {/* Flow indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[10px]">→ Qwen2.5+LoRA (Unsloth) → LM Loss</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Eff. batch",  value: "8×2=16", color: "text-accent-purple" },
                  { label: "Steps/epoch", value: "2,500",  color: "text-accent-cyan"   },
                  { label: "Total steps", value: "7,500",  color: "text-accent-green"  },
                ].map(s => (
                  <div key={s.label} className="p-2 rounded bg-muted/30 border border-border/30">
                    <div className="text-[9px] text-muted-foreground">{s.label}</div>
                    <div className={`text-xs font-bold font-mono ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AdamW Optimizer */}
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={15} className="text-accent-red" />
                <h3 className="font-semibold text-sm">paged_adamw_32bit — Optimizer</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                AdamW tracks two moment estimates per parameter. &ldquo;Paged&rdquo; offloads optimizer state to CPU pages when needed, saving GPU memory.
              </p>

              {/* Update formula */}
              <div className="p-3 rounded-lg bg-card border border-border/40 font-mono text-xs mb-4">
                <div className="text-[9px] text-muted-foreground mb-2 uppercase tracking-wider">Update rule</div>
                <div className="space-y-1.5 leading-relaxed">
                  <div>
                    <span className="text-amber-400 font-bold">m</span>
                    <span className="text-muted-foreground">_t = β₁·</span>
                    <span className="text-amber-400">m</span>
                    <span className="text-muted-foreground">_{"{t-1}"} + (1-β₁)·</span>
                    <span className="text-accent-red">g</span>
                    <span className="text-muted-foreground">_t</span>
                  </div>
                  <div>
                    <span className="text-accent-purple font-bold">v</span>
                    <span className="text-muted-foreground">_t = β₂·</span>
                    <span className="text-accent-purple">v</span>
                    <span className="text-muted-foreground">_{"{t-1}"} + (1-β₂)·</span>
                    <span className="text-accent-red">g</span>
                    <span className="text-muted-foreground">_t²</span>
                  </div>
                  <div className="border-t border-border/30 pt-1.5">
                    <span className="text-accent-cyan font-bold">θ</span>
                    <span className="text-muted-foreground">_t = </span>
                    <span className="text-accent-cyan">θ</span>
                    <span className="text-muted-foreground">_{"{t-1}"} − η·(</span>
                    <span className="text-amber-400">m̂</span>
                    <span className="text-muted-foreground">/(√</span>
                    <span className="text-accent-purple">v̂</span>
                    <span className="text-muted-foreground">+ε) + λ·</span>
                    <span className="text-accent-cyan">θ</span>
                    <span className="text-muted-foreground">)</span>
                  </div>
                </div>
              </div>

              {/* Moment bars */}
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-400 font-mono font-bold">m_t  (1st moment — momentum)</span>
                    <span className="text-amber-400/70 font-mono">{(adamM * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-amber-400/70"
                      style={{ width: `${adamM * 100}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">β₁=0.9 — running mean of gradients</div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-accent-purple font-mono font-bold">v_t  (2nd moment — variance)</span>
                    <span className="text-accent-purple/70 font-mono">{(adamV * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent-purple/70"
                      style={{ width: `${adamV * 100}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">β₂=0.999 — running mean of squared gradients</div>
                </div>
              </div>

              {/* Key hyperparams */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {[
                  ["η (LR)",          "2e-4"],
                  ["β₁",             "0.9"],
                  ["β₂",             "0.999"],
                  ["ε",              "1e-8"],
                  ["λ (weight decay)", "0.01"],
                  ["grad clip",       "0.3"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between p-1.5 rounded bg-muted/30 border border-border/20">
                    <span className="text-muted-foreground font-mono">{k}</span>
                    <span className="font-mono font-semibold text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
