"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, BrainCircuit, ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { PhaseNav } from "@/components/training/PhaseNav";
import { NeuralBackground } from "@/components/training/NeuralBackground";
const Phase1Data    = dynamic(() => import("@/components/training/Phase1Data").then((m) => ({ default: m.Phase1Data })), { ssr: false });
const Phase2QLoRA   = dynamic(() => import("@/components/training/Phase2QLoRA").then((m) => ({ default: m.Phase2QLoRA })), { ssr: false });
const Phase3LoRA    = dynamic(() => import("@/components/training/Phase3LoRA").then((m) => ({ default: m.Phase3LoRA })), { ssr: false });
const Phase4Training = dynamic(() => import("@/components/training/Phase4Training").then((m) => ({ default: m.Phase4Training })), { ssr: false });
const Phase5Results = dynamic(() => import("@/components/training/Phase5Results").then((m) => ({ default: m.Phase5Results })), { ssr: false });

const PHASES = [
  { id: 1, label: "Data Pipeline",     duration: 18000 },
  { id: 2, label: "QLoRA Setup",       duration: 24000 },
  { id: 3, label: "LoRA Injection",    duration: 22000 },
  { id: 4, label: "Training Loop",     duration: 30000 },
  { id: 5, label: "Results & Deploy",  duration: 18000 },
];

const TOTAL_DURATION = PHASES.reduce((acc, p) => acc + p.duration, 0);

const PHASE_COMPONENTS = [Phase1Data, Phase2QLoRA, Phase3LoRA, Phase4Training, Phase5Results];

export default function TrainingPage() {
  const [currentPhase, setCurrentPhase]       = useState(1);
  const [phaseKey, setPhaseKey]               = useState(0);
  const [autoRunning, setAutoRunning]         = useState(false);
  const [paused, setPaused]                   = useState(false);
  const [done, setDone]                       = useState(false);
  const [totalProgress, setTotalProgress]     = useState(0);
  const [phaseProgress, setPhaseProgress]     = useState(0);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());

  const startTimeRef      = useRef<number>(0);
  const pausedAtRef       = useRef<number>(0);
  const totalPausedRef    = useRef<number>(0);
  const rafRef            = useRef<number>(0);
  const prevPhaseRef      = useRef<number>(1);

  const markCompleted = useCallback((phase: number) => {
    setCompletedPhases(prev => new Set(prev).add(phase));
  }, []);

  const tick = useCallback(() => {
    const now     = Date.now();
    const elapsed = now - startTimeRef.current - totalPausedRef.current;
    const clamped = Math.min(elapsed / TOTAL_DURATION, 1);
    setTotalProgress(clamped * 100);

    let acc      = 0;
    let newPhase = PHASES[PHASES.length - 1].id;
    let pp       = 100;

    for (const p of PHASES) {
      if (elapsed < acc + p.duration) {
        newPhase = p.id;
        pp = Math.min(((elapsed - acc) / p.duration) * 100, 100);
        break;
      }
      acc += p.duration;
    }

    setPhaseProgress(pp);
    setCurrentPhase(prev => {
      if (prev !== newPhase) {
        setPhaseKey(k => k + 1);
      }
      return newPhase;
    });

    if (elapsed >= TOTAL_DURATION) {
      setTotalProgress(100);
      setPhaseProgress(100);
      setAutoRunning(false);
      setDone(true);
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startAutoRun = useCallback(() => {
    setDone(false);
    setTotalProgress(0);
    setPhaseProgress(0);
    setCurrentPhase(1);
    setPhaseKey(k => k + 1);
    setAutoRunning(true);
    setPaused(false);
    setCompletedPhases(new Set());
    prevPhaseRef.current    = 1;
    startTimeRef.current    = Date.now();
    totalPausedRef.current  = 0;
    pausedAtRef.current     = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pauseResume = useCallback(() => {
    if (paused) {
      const dur = Date.now() - pausedAtRef.current;
      totalPausedRef.current += dur;
      setPaused(false);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      pausedAtRef.current = Date.now();
      setPaused(true);
      cancelAnimationFrame(rafRef.current);
    }
  }, [paused, tick]);

  const resetPipeline = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setAutoRunning(false);
    setPaused(false);
    setDone(false);
    setTotalProgress(0);
    setPhaseProgress(0);
    setCurrentPhase(1);
    setPhaseKey(k => k + 1);
    setCompletedPhases(new Set());
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const goToPhase = useCallback((phase: number) => {
    if (autoRunning && !paused) {
      pausedAtRef.current = Date.now();
      setPaused(true);
      cancelAnimationFrame(rafRef.current);
    }
    setCurrentPhase(phase);
    setPhaseKey(k => k + 1);
    setPhaseProgress(0);
  }, [autoRunning, paused]);

  const PhaseComponent = PHASE_COMPONENTS[currentPhase - 1];

  return (
    <div className="space-y-6 relative min-h-screen">
      <NeuralBackground />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-panel rounded-2xl p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 via-accent-purple/5 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                <BrainCircuit className="text-accent-cyan" size={22} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Fine-Tuning Pipeline · sentra-utoledo-v2.0 · Unsloth
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              <span className="neon-text">Sentra</span>
              <span className="text-foreground"> — Training Journey</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
              Watch how we fine-tuned{" "}
              <code className="text-accent-cyan text-xs bg-accent-cyan/10 px-1.5 py-0.5 rounded">
                Qwen2.5-1.5B-Instruct (1.54B params)
              </code>{" "}
              into a production-grade phishing detector using QLoRA — every
              hyperparameter, every phase, visualized live.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {autoRunning && (
              <>
                <button
                  onClick={pauseResume}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                  {paused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={resetPipeline}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <RotateCcw size={15} />
                  Reset
                </button>
              </>
            )}
            {!autoRunning && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={done ? resetPipeline : startAutoRun}
                className="btn-neon flex items-center gap-2.5 px-7 py-3.5 rounded-xl border border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan font-semibold text-sm hover:bg-accent-cyan/20 transition-all shadow-[0_0_30px_hsl(var(--accent-cyan)/0.2)]"
              >
                {done ? (
                  <><RotateCcw size={16} /> Run Again</>
                ) : (
                  <><Play size={16} fill="currentColor" /> Run Pipeline</>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {(autoRunning || done) && (
          <div className="mt-6 relative z-10">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span className="font-medium">Pipeline Progress</span>
              <span>{Math.round(totalProgress)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-green"
                animate={{ width: `${totalProgress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          </div>
        )}

        {done && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm font-medium flex items-center gap-2"
          >
            <span className="text-base">✓</span>
            Pipeline complete — Sentra successfully fine-tuned and pushed to HuggingFace
          </motion.div>
        )}
      </motion.div>

      {/* ── Phase navigator ───────────────────────────────────── */}
      <PhaseNav
        currentPhase={currentPhase}
        onPhaseSelect={goToPhase}
        autoRunning={autoRunning && !paused}
        phaseProgress={phaseProgress}
        completedPhases={done ? [1,2,3,4,5] : PHASES.filter(p => p.id < currentPhase).map(p => p.id)}
      />

      {/* ── Active phase content ──────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`phase-${currentPhase}-${phaseKey}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <PhaseComponent
            autoPlay={autoRunning && !paused}
            phaseProgress={phaseProgress}
            wasCompleted={completedPhases.has(currentPhase)}
            onComplete={() => markCompleted(currentPhase)}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Prev / Next ───────────────────────────────────────── */}
      <div className="flex justify-between items-center pb-8">
        <button
          onClick={() => currentPhase > 1 && goToPhase(currentPhase - 1)}
          disabled={currentPhase === 1}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/60 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <span className="text-xs text-muted-foreground">
          Phase {currentPhase} of {PHASES.length}
        </span>

        <button
          onClick={() => currentPhase < PHASES.length && goToPhase(currentPhase + 1)}
          disabled={currentPhase === PHASES.length}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/60 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
