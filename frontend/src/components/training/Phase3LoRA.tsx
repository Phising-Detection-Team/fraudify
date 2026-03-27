"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Lock, Zap, Play, RotateCcw, Info, Snowflake } from "lucide-react";
import { SentraMascot } from "./SentraMascot";

interface PhaseProps { autoPlay: boolean; phaseProgress: number; wasCompleted?: boolean; onComplete?: () => void; }

const LAYERS = 6;
const TARGET_MODULES = ["q_lin", "k_lin", "v_lin", "out_lin"];
const TRAINABLE_TOTAL = 589824;
const ALL_PARAMS      = 66362880;
const RANK            = 16;
const ALPHA           = 32;
const HIDDEN          = 768;

function useCounter(target: number, durationMs: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || target === 0) return;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);
  return val;
}

// Ice crystal burst: tiny SVG snowflake burst animation
function IceBurst({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.2, delay: 0.3 }}
    >
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <motion.div
          key={deg}
          className="absolute w-1 h-1 rounded-full bg-sky-300"
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: Math.cos((deg * Math.PI) / 180) * 28,
            y: Math.sin((deg * Math.PI) / 180) * 28,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.7, delay: i * 0.03, ease: "easeOut" }}
        />
      ))}
    </motion.div>
  );
}

export function Phase3LoRA({ autoPlay, wasCompleted, onComplete }: PhaseProps) {
  const [stage, setStage]               = useState(0);
  const [playing, setPlaying]           = useState(false);
  const [frozenLayers, setFrozen]       = useState<number[]>([]);
  const [injectedLayers, setInjected]   = useState<number[]>([]);
  const [burstLayer, setBurstLayer]     = useState<number | null>(null);
  const [allFrozenFlash, setAllFrozenFlash] = useState(false);
  const [countActive, setCountActive]   = useState(false);
  const [rankSlider, setRankSlider]     = useState(RANK);
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trainable = useCounter(TRAINABLE_TOTAL, 3000, countActive);
  const pct = ((trainable / ALL_PARAMS) * 100).toFixed(2);
  const sliderParams = 24 * 2 * HIDDEN * rankSlider;
  const sliderPct    = ((sliderParams / ALL_PARAMS) * 100).toFixed(2);

  const startPlay = () => {
    timers.current.forEach(clearTimeout);
    setStage(0); setFrozen([]); setInjected([]); setCountActive(false);
    setPlaying(true); setBurstLayer(null); setAllFrozenFlash(false);

    // Stage 1: Low-rank decomp + architecture appear (warm state)
    timers.current.push(setTimeout(() => setStage(1), 300));

    // Stage 2: "FREEZE PROTOCOL" — freeze wave begins
    timers.current.push(setTimeout(() => setStage(2), 1800));

    // Freeze each layer one by one (800ms apart)
    for (let i = 0; i < LAYERS; i++) {
      const t = 2200 + i * 800;
      timers.current.push(setTimeout(() => {
        setFrozen(prev => [...prev, i]);
        setBurstLayer(i);
        setTimeout(() => setBurstLayer(null), 900);
      }, t));
    }

    // All layers frozen — flash "ALL FROZEN" banner
    timers.current.push(setTimeout(() => {
      setAllFrozenFlash(true);
      setStage(3);
    }, 7200));

    // Stage 4: LoRA injection begins (700ms stagger per layer)
    timers.current.push(setTimeout(() => setStage(4), 9000));
    for (let i = 0; i < LAYERS; i++) {
      timers.current.push(
        setTimeout(() => setInjected(prev => [...prev, i]), 9400 + i * 700)
      );
    }

    // Stage 5: param counter + formula
    timers.current.push(setTimeout(() => { setStage(5); setCountActive(true); }, 14200));
    timers.current.push(setTimeout(() => setStage(6), 15000));
    timers.current.push(setTimeout(() => { setStage(7); onComplete?.(); }, 15800));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setStage(0); setFrozen([]); setInjected([]); setCountActive(false);
    setPlaying(false); setBurstLayer(null); setAllFrozenFlash(false); setHoveredLayer(null);
  };

  useEffect(() => {
    if (wasCompleted) {
      setStage(7); setFrozen([0,1,2,3,4,5]); setInjected([0,1,2,3,4,5]);
      setAllFrozenFlash(true); setCountActive(true); setPlaying(true);
    } else if (autoPlay) {
      startPlay();
    }
    return () => timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return (
    <div className="space-y-6">
      {/* Sentra Mascot */}
      <SentraMascot phase={3} active={stage >= 1} instant={wasCompleted} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitBranch size={20} className="text-accent-purple" />
            LoRA Adapter Injection
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Freeze 99.1% of weights — inject trainable low-rank adapters into attention layers
          </p>
        </div>
        <div className="flex gap-2">
          {playing && (
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:bg-muted transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          )}
          {!playing && (
            <button onClick={startPlay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-accent-purple/40 bg-accent-purple/5 text-accent-purple hover:bg-accent-purple/10 transition-colors">
              <Play size={12} /> Play Phase
            </button>
          )}
        </div>
      </div>

      {/* ── Section 1: Low-Rank Decomposition ── */}
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-6"
          >
            <h3 className="font-semibold text-sm mb-1">Low-Rank Decomposition — Why LoRA Works</h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-2xl">
              Instead of updating the full W matrix (768×768 = <strong>589,824 params per module</strong>),
              LoRA learns two small matrices A and B whose product approximates the weight update ΔW.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 flex-wrap">
              {/* Full W */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Full fine-tuning</div>
                <motion.div
                  className="relative flex items-center justify-center rounded border-2"
                  style={{ width: 88, height: 88, borderColor: "rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.07)" }}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: "backOut" }}
                >
                  <span className="font-bold text-xl font-mono text-red-400">W</span>
                  <div className="absolute top-1 right-2 text-[8px] font-mono text-red-400/50">768</div>
                  <div className="absolute bottom-1 left-1 text-[8px] font-mono text-red-400/50">768</div>
                </motion.div>
                <div className="text-[10px] font-mono text-red-400">589,824 params</div>
                <div className="text-[10px] text-red-400 font-semibold">✗ update all</div>
              </div>

              <div className="text-muted-foreground text-lg">→</div>

              {/* LoRA A × B */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-accent-purple">LoRA decomposition</div>
                <div className="flex items-end gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <motion.div
                      className="flex items-center justify-center rounded border-2"
                      style={{ width: 17, height: 88, borderColor: "rgba(147,51,234,0.6)", background: "rgba(147,51,234,0.12)" }}
                      animate={{ boxShadow: ["0 0 0 rgba(147,51,234,0)", "0 0 14px rgba(147,51,234,0.55)", "0 0 6px rgba(147,51,234,0.25)"] }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                    >
                      <span className="font-bold text-xs font-mono text-accent-purple" style={{ writingMode: "vertical-rl" }}>A</span>
                    </motion.div>
                    <div className="text-[9px] font-mono text-accent-purple/80">768×{RANK}</div>
                  </div>
                  <span className="text-muted-foreground font-bold mb-12">×</span>
                  <div className="flex flex-col items-center gap-1 self-start mt-[56px]">
                    <motion.div
                      className="flex items-center justify-center rounded border-2"
                      style={{ width: 88, height: 17, borderColor: "rgba(0,209,255,0.6)", background: "rgba(0,209,255,0.12)" }}
                      animate={{ boxShadow: ["0 0 0 rgba(0,209,255,0)", "0 0 14px rgba(0,209,255,0.4)", "0 0 6px rgba(0,209,255,0.2)"] }}
                      transition={{ duration: 2, delay: 0.6, repeat: Infinity, repeatType: "reverse" }}
                    >
                      <span className="font-bold text-xs font-mono text-accent-cyan">B</span>
                    </motion.div>
                    <div className="text-[9px] font-mono text-accent-cyan/80">{RANK}×768</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-accent-purple">12,288 + 12,288 params</div>
                <div className="text-[10px] text-accent-green font-semibold">✓ only A &amp; B updated</div>
              </div>

              <div className="text-muted-foreground text-lg">=</div>

              {/* ΔW */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-accent-green">Approximated ΔW</div>
                <motion.div
                  className="flex items-center justify-center rounded border-2"
                  style={{ width: 88, height: 88, borderColor: "rgba(0,200,100,0.4)", background: "rgba(0,200,100,0.06)" }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5, ease: "backOut" }}
                >
                  <span className="font-bold text-xl font-mono text-accent-green">ΔW</span>
                </motion.div>
                <div className="text-[10px] font-mono text-accent-green">768×768 shape</div>
                <div className="text-[10px] text-accent-green font-semibold">same shape as W</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Full W (per module)",        value: "589,824",                         color: "text-red-400",      bg: "bg-red-500/5",        border: "border-red-500/20"        },
                { label: "LoRA A+B (per module)",      value: "24,576",                          color: "text-accent-green", bg: "bg-accent-green/5",   border: "border-accent-green/20"   },
                { label: "Reduction per module",       value: "95.8%",                           color: "text-accent-cyan",  bg: "bg-accent-cyan/5",    border: "border-accent-cyan/20"    },
                { label: "Total trainable (24 mods)",  value: TRAINABLE_TOTAL.toLocaleString(),  color: "text-accent-purple", bg: "bg-accent-purple/5", border: "border-accent-purple/20"  },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className={`p-3 rounded-lg border text-center ${s.bg} ${s.border}`}
                >
                  <div className="text-[10px] text-muted-foreground mb-1">{s.label}</div>
                  <div className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FREEZE PROTOCOL BANNER ── */}
      <AnimatePresence>
        {stage >= 2 && stage < 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel rounded-xl px-6 py-4 border border-sky-400/40 bg-sky-400/5 flex items-center gap-4"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Snowflake size={22} className="text-sky-300" />
            </motion.div>
            <div>
              <div className="text-sm font-bold text-sky-300 tracking-widest uppercase">
                ❄ Freeze Protocol Initiated
              </div>
              <div className="text-xs text-sky-400/70 mt-0.5">
                Locking all {(ALL_PARAMS - TRAINABLE_TOTAL).toLocaleString()} base parameters — no gradients will flow through W
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-sky-300 font-mono font-bold">
                {frozenLayers.length}/{LAYERS} layers
              </div>
              <div className="text-[10px] text-sky-400/60">frozen</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ALL FROZEN BANNER ── */}
      <AnimatePresence>
        {allFrozenFlash && stage < 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1, boxShadow: ["0 0 0px rgba(125,211,252,0)", "0 0 30px rgba(125,211,252,0.4)", "0 0 10px rgba(125,211,252,0.2)"] }}
            exit={{ opacity: 0 }}
            className="glass-panel rounded-xl px-6 py-4 border border-sky-300/60 bg-sky-300/10 text-center"
          >
            <div className="text-base font-bold text-sky-200 tracking-widest uppercase">
              ✦ ALL 66M BASE WEIGHTS FROZEN ✦
            </div>
            <div className="text-xs text-sky-300/70 mt-1">
              Gradient computation disabled — model cannot modify these weights during training
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LoRA INJECTION BANNER ── */}
      <AnimatePresence>
        {stage >= 4 && stage < 5 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel rounded-xl px-6 py-4 border border-accent-purple/50 bg-accent-purple/5 flex items-center gap-4"
          >
            <motion.div
              animate={{ scale: [1, 1.25, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Zap size={22} className="text-accent-purple" />
            </motion.div>
            <div>
              <div className="text-sm font-bold text-accent-purple tracking-widest uppercase">
                ⚡ LoRA Adapters Injecting…
              </div>
              <div className="text-xs text-accent-purple/70 mt-0.5">
                Inserting trainable A &amp; B matrices alongside each frozen attention module
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-accent-purple font-mono font-bold">
                {injectedLayers.length}/{LAYERS} layers
              </div>
              <div className="text-[10px] text-accent-purple/60">injected</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 2: Layer Diagram + Right Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {stage >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 glass-panel rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">DistilBERT — 6 Transformer Layers</h3>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-muted-foreground/30" />warm</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-sky-400/50" />frozen</div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-accent-purple" />LoRA</div>
                </div>
              </div>

              <div className="space-y-2">
                {Array.from({ length: LAYERS }, (_, layerIdx) => {
                  const isFrozen   = frozenLayers.includes(layerIdx);
                  const isInjected = injectedLayers.includes(layerIdx);
                  const isBursting = burstLayer === layerIdx;

                  return (
                    <motion.div
                      key={layerIdx}
                      className={`rounded-lg border transition-all duration-700 relative overflow-hidden ${
                        isInjected
                          ? "border-accent-purple/50 bg-accent-purple/8"
                          : isFrozen
                          ? "border-sky-400/50 bg-sky-400/5"
                          : "border-border/40 bg-background/30"
                      }`}
                      animate={isInjected ? {
                        boxShadow: ["0 0 0px rgba(147,51,234,0)", "0 0 18px rgba(147,51,234,0.45)", "0 0 6px rgba(147,51,234,0.2)"]
                      } : isFrozen ? {
                        boxShadow: ["0 0 0px rgba(125,211,252,0)", "0 0 12px rgba(125,211,252,0.3)", "0 0 4px rgba(125,211,252,0.1)"]
                      } : {}}
                      transition={{ duration: 1.5, repeat: isInjected || isFrozen ? Infinity : 0, repeatType: "reverse" }}
                      onMouseEnter={() => setHoveredLayer(layerIdx)}
                      onMouseLeave={() => setHoveredLayer(null)}
                    >
                      {/* Ice burst particles */}
                      <IceBurst active={isBursting} />

                      {/* Freeze wave overlay */}
                      <AnimatePresence>
                        {isFrozen && !isInjected && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ background: "linear-gradient(90deg, rgba(125,211,252,0.04), rgba(56,189,248,0.07))" }}
                          />
                        )}
                      </AnimatePresence>

                      <div className="p-3 relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ${
                            isInjected ? "text-accent-purple" : isFrozen ? "text-sky-300" : "text-amber-400/70"
                          }`}>
                            Layer {layerIdx + 1}
                          </span>

                          {/* Freeze badge */}
                          <AnimatePresence>
                            {isFrozen && !isInjected && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/15 border border-sky-400/30 text-sky-300 font-semibold flex items-center gap-1"
                              >
                                <Lock size={8} />
                                frozen
                              </motion.span>
                            )}
                          </AnimatePresence>

                          {/* LoRA injected badge */}
                          <AnimatePresence>
                            {isInjected && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/20 border border-accent-purple/40 text-accent-purple font-semibold"
                              >
                                LoRA injected ✓
                              </motion.span>
                            )}
                          </AnimatePresence>

                          {hoveredLayer === layerIdx && isInjected && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1"
                            >
                              <Info size={10} />
                              {(TRAINABLE_TOTAL / LAYERS).toLocaleString()} new params
                            </motion.span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                          {TARGET_MODULES.map(mod => (
                            <div key={mod} className="flex items-center gap-1 flex-nowrap">
                              <div className={`text-[9px] px-2 py-1 rounded border font-mono flex items-center gap-1 transition-all duration-500 ${
                                isInjected
                                  ? "bg-muted/40 border-border/20 text-muted-foreground/60"
                                  : isFrozen
                                  ? "bg-sky-400/5 border-sky-400/25 text-sky-300/60"
                                  : "bg-amber-500/5 border-amber-400/25 text-amber-300/70"
                              }`}>
                                {mod}
                                <Lock size={7} className={`shrink-0 ${isFrozen ? "opacity-70 text-sky-300" : "opacity-40"}`} />
                              </div>

                              {/* LoRA A+B badges slide in after injection */}
                              <AnimatePresence>
                                {isInjected && (
                                  <motion.div
                                    initial={{ opacity: 0, scaleX: 0 }}
                                    animate={{ opacity: 1, scaleX: 1 }}
                                    transition={{ duration: 0.4, ease: "backOut" }}
                                    className="flex items-center gap-0 origin-left"
                                  >
                                    <div className="w-3 h-px bg-border/50" />
                                    <motion.div
                                      animate={{ boxShadow: ["0 0 0 rgba(147,51,234,0)", "0 0 9px rgba(147,51,234,0.65)", "0 0 3px rgba(147,51,234,0.25)"] }}
                                      transition={{ duration: 1, repeat: 3 }}
                                      className="text-[9px] px-1.5 py-1 rounded-l bg-accent-purple/20 border border-r-0 border-accent-purple/50 text-accent-purple font-mono font-bold"
                                    >
                                      A
                                    </motion.div>
                                    <div className="text-[9px] px-1.5 py-1 rounded-r bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan font-mono font-bold">
                                      B
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}

                          <div className="text-[9px] px-2 py-1 rounded border border-border/20 bg-muted/15 text-muted-foreground/40 font-mono flex items-center gap-1">
                            FFN <Lock size={7} className="opacity-25" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right panel */}
        <div className="space-y-4">
          <AnimatePresence>
            {stage >= 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-accent-cyan" />
                  <h3 className="font-semibold text-sm">Trainable Params</h3>
                </div>

                <div className="text-3xl font-bold font-mono text-accent-cyan tabular-nums mb-1">
                  {trainable.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  out of {ALL_PARAMS.toLocaleString()} total
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, hsl(var(--accent-purple)), hsl(var(--accent-cyan)))" }}
                    animate={{ width: `${(trainable / ALL_PARAMS) * 100}%` }}
                    transition={{ duration: 0.05 }}
                  />
                </div>
                <div className="text-xs text-accent-purple font-semibold">
                  {pct}% trainable · 99.1% frozen
                </div>

                <div className="mt-4 p-2.5 rounded-lg bg-muted/40 text-xs space-y-1.5">
                  {([
                    ["Rank (r)",     `${RANK}`],
                    ["Alpha (α)",    `${ALPHA}`],
                    ["Scale (α/r)", `${(ALPHA / RANK).toFixed(1)}×`],
                    ["Dropout",     "0.1"],
                    ["Target mods", "4 × 6 = 24"],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {stage >= 6 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-xl p-5"
              >
                <h3 className="font-semibold text-sm mb-3">LoRA Formula</h3>

                <div className="p-3 rounded-lg bg-card border border-border/40 font-mono text-center mb-3">
                  <div className="text-[9px] text-muted-foreground mb-1.5 uppercase tracking-wider">Forward Pass</div>
                  <div className="text-xs">
                    <span className="text-muted-foreground/60">W</span>
                    <span className="text-muted-foreground">·x  +  </span>
                    <span className="text-accent-cyan font-bold">B</span>
                    <span className="text-accent-purple font-bold">·A</span>
                    <span className="text-muted-foreground">·x · (α/r)</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1.5">W frozen · only B·A backprops</div>
                </div>

                <div className="space-y-1.5 text-xs">
                  {([
                    ["A  init", "Gaussian random",   "text-accent-purple"],
                    ["B  init", "zeros → ΔW=0 at t=0", "text-accent-cyan"],
                    ["A shape", `ℝ^(${HIDDEN}×${RANK})`, "text-accent-purple"],
                    ["B shape", `ℝ^(${RANK}×${HIDDEN})`, "text-accent-cyan"],
                  ] as [string, string, string][]).map(([k, v, c]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-muted-foreground font-mono">{k}</span>
                      <span className={`font-mono font-semibold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Section 3: Gradient Flow ── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-6"
          >
            <h3 className="font-semibold text-sm mb-1">Gradient Flow — What Gets Updated?</h3>
            <p className="text-xs text-muted-foreground mb-5">
              During backprop, <strong>W stays frozen</strong>. Only A and B receive gradient updates — cutting 99% of optimizer memory.
            </p>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
                <svg viewBox="0 0 280 242" className="w-full max-w-[280px]">
                  <rect x="110" y="4" width="60" height="26" rx="5" fill="rgba(0,209,255,0.1)" stroke="rgba(0,209,255,0.5)" strokeWidth="1.5" />
                  <text x="140" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(0,209,255,0.9)">Input x</text>

                  <line x1="140" y1="30" x2="140" y2="46" stroke="rgba(160,160,160,0.35)" strokeWidth="1" />
                  <line x1="140" y1="46" x2="70" y2="46" stroke="rgba(160,160,160,0.35)" strokeWidth="1" />
                  <line x1="140" y1="46" x2="210" y2="46" stroke="rgba(147,51,234,0.5)" strokeWidth="1.5" />
                  <line x1="70" y1="46" x2="70" y2="64" stroke="rgba(160,160,160,0.35)" strokeWidth="1" />
                  <line x1="210" y1="46" x2="210" y2="64" stroke="rgba(147,51,234,0.5)" strokeWidth="1.5" />

                  <rect x="32" y="64" width="76" height="52" rx="6" fill="rgba(100,100,100,0.08)" stroke="rgba(100,100,100,0.25)" strokeWidth="1.5" strokeDasharray="4 2" />
                  <text x="70" y="85" textAnchor="middle" fontSize="13" fontWeight="800" fill="rgba(150,150,150,0.55)">W</text>
                  <text x="70" y="99" textAnchor="middle" fontSize="7" fill="rgba(120,120,120,0.5)">768×768</text>
                  <text x="70" y="112" textAnchor="middle" fontSize="8" fill="rgba(120,120,120,0.45)">🔒 frozen</text>

                  <rect x="172" y="64" width="76" height="28" rx="5" fill="rgba(147,51,234,0.12)" stroke="rgba(147,51,234,0.55)" strokeWidth="1.5" />
                  <text x="210" y="82" textAnchor="middle" fontSize="10" fontWeight="800" fill="rgba(147,51,234,0.9)">A  (768×16)</text>

                  <rect x="172" y="100" width="76" height="28" rx="5" fill="rgba(0,209,255,0.12)" stroke="rgba(0,209,255,0.55)" strokeWidth="1.5" />
                  <text x="210" y="118" textAnchor="middle" fontSize="10" fontWeight="800" fill="rgba(0,209,255,0.9)">B  (16×768)</text>

                  <line x1="70" y1="116" x2="70" y2="148" stroke="rgba(160,160,160,0.35)" strokeWidth="1" />
                  <line x1="210" y1="128" x2="210" y2="148" stroke="rgba(147,51,234,0.5)" strokeWidth="1.5" />
                  <line x1="70" y1="148" x2="210" y2="148" stroke="rgba(160,160,160,0.3)" strokeWidth="1" strokeDasharray="3 2" />
                  <line x1="140" y1="148" x2="140" y2="164" stroke="rgba(0,200,100,0.5)" strokeWidth="1.5" />

                  <rect x="92" y="164" width="96" height="28" rx="5" fill="rgba(0,200,100,0.1)" stroke="rgba(0,200,100,0.4)" strokeWidth="1.5" />
                  <text x="140" y="182" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(0,200,100,0.9)">W·x + B·A·x·(α/r)</text>

                  <line x1="140" y1="192" x2="140" y2="208" stroke="rgba(0,200,100,0.5)" strokeWidth="1.5" />
                  <rect x="92" y="208" width="96" height="26" rx="5" fill="rgba(0,200,100,0.08)" stroke="rgba(0,200,100,0.35)" strokeWidth="1.5" />
                  <text x="140" y="225" textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(0,200,100,0.8)">Output h</text>

                  <text x="30" y="145" textAnchor="middle" fontSize="8" fill="rgba(120,120,120,0.5)">no grad →</text>
                  <text x="252" y="145" textAnchor="middle" fontSize="8" fill="rgba(147,51,234,0.7)">← grad ✓</text>
                </svg>
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "W (frozen)", note: "No gradient — 0 optimizer states", color: "text-muted-foreground/60", border: "border-border/30", bg: "bg-muted/10" },
                    { label: "A matrix", note: "∇A computed — updated by AdamW", color: "text-accent-purple", border: "border-accent-purple/30", bg: "bg-accent-purple/5" },
                    { label: "B matrix", note: "∇B computed — updated by AdamW", color: "text-accent-cyan", border: "border-accent-cyan/30", bg: "bg-accent-cyan/5" },
                    { label: "Memory saved", note: "~99% fewer optimizer states", color: "text-accent-green", border: "border-accent-green/30", bg: "bg-accent-green/5" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.12 }}
                      className={`p-3 rounded-lg border ${item.bg} ${item.border}`}
                    >
                      <div className={`text-xs font-bold mb-0.5 ${item.color}`}>{item.label}</div>
                      <div className="text-[10px] text-muted-foreground">{item.note}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-card border border-border/40">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Rank Explorer — adjust r to see parameter tradeoff</div>
                  <input
                    type="range" min={1} max={64} value={rankSlider}
                    onChange={e => setRankSlider(Number(e.target.value))}
                    className="w-full accent-purple-500 mb-2"
                  />
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-accent-purple">r = {rankSlider}</span>
                    <span className="text-accent-cyan">{sliderParams.toLocaleString()} params</span>
                    <span className="text-accent-green">{sliderPct}% of model</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 4: Completion Banner ── */}
      <AnimatePresence>
        {stage >= 7 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, boxShadow: ["0 0 0px rgba(147,51,234,0)", "0 0 40px rgba(147,51,234,0.3)", "0 0 15px rgba(147,51,234,0.15)"] }}
            className="glass-panel rounded-xl px-6 py-5 border border-accent-purple/40 bg-accent-purple/5 text-center"
          >
            <div className="text-base font-bold text-accent-purple tracking-wider mb-1">
              ✦ LoRA Injection Complete — 24 Adapter Pairs Active ✦
            </div>
            <div className="text-xs text-muted-foreground">
              589,824 trainable parameters · 65,773,056 frozen · Ready for training
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[11px]">
              <span className="px-2.5 py-1 rounded-full bg-accent-purple/15 border border-accent-purple/30 text-accent-purple font-mono">r=16 · α=32</span>
              <span className="px-2.5 py-1 rounded-full bg-accent-cyan/15 border border-accent-cyan/30 text-accent-cyan font-mono">4 modules × 6 layers</span>
              <span className="px-2.5 py-1 rounded-full bg-accent-green/15 border border-accent-green/30 text-accent-green font-mono">~0.9% trainable</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
