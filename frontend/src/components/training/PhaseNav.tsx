"use client";

import { motion } from "framer-motion";
import { Database, Cpu, GitBranch, RefreshCw, Rocket, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PHASES = [
  { id: 1, label: "Data Pipeline",    shortLabel: "Data",     icon: Database   },
  { id: 2, label: "QLoRA Setup",      shortLabel: "QLoRA",    icon: Cpu        },
  { id: 3, label: "LoRA Injection",   shortLabel: "LoRA",     icon: GitBranch  },
  { id: 4, label: "Training Loop",    shortLabel: "Training", icon: RefreshCw  },
  { id: 5, label: "Results & Deploy", shortLabel: "Results",  icon: Rocket     },
];

interface PhaseNavProps {
  currentPhase:    number;
  onPhaseSelect:   (phase: number) => void;
  autoRunning:     boolean;
  phaseProgress:   number;
  completedPhases: number[];
}

export function PhaseNav({
  currentPhase,
  onPhaseSelect,
  autoRunning,
  phaseProgress,
  completedPhases,
}: PhaseNavProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-panel rounded-xl p-4"
    >
      {/* Circuit connector line */}
      <div className="relative flex items-center justify-between gap-2 mb-1">
        {/* Background connecting line */}
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-px bg-border/60 z-0" />

        {/* Animated fill line */}
        {autoRunning && (
          <motion.div
            className="absolute left-8 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-accent-cyan to-accent-purple z-0"
            animate={{
              width: `calc(${((currentPhase - 1 + phaseProgress / 100) / (PHASES.length - 1)) * (100)} * (100% - 4rem) / 100)`,
            }}
            transition={{ duration: 0.15, ease: "linear" }}
          />
        )}

        {PHASES.map((phase) => {
          const isActive    = phase.id === currentPhase;
          const isCompleted = completedPhases.includes(phase.id);
          const Icon        = phase.icon;

          return (
            <button
              key={phase.id}
              onClick={() => onPhaseSelect(phase.id)}
              className={cn(
                "relative z-10 flex flex-col items-center gap-1.5 group transition-all duration-200 flex-1",
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative",
                  isActive
                    ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan shadow-[0_0_12px_hsl(var(--accent-cyan)/0.4)]"
                    : isCompleted
                    ? "bg-accent-green/15 border-accent-green text-accent-green"
                    : "bg-background border-border/50 text-muted-foreground hover:border-accent-cyan/40 hover:text-accent-cyan/70"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check size={14} />
                ) : (
                  <Icon size={14} />
                )}

                {/* Live pulse for active phase in auto-run */}
                {isActive && autoRunning && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-accent-cyan"
                    animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </div>

              <span
                className={cn(
                  "text-[10px] font-semibold hidden sm:block transition-colors",
                  isActive
                    ? "text-accent-cyan"
                    : isCompleted
                    ? "text-accent-green"
                    : "text-muted-foreground"
                )}
              >
                {phase.shortLabel}
              </span>

              {/* Per-phase progress bar */}
              {isActive && (
                <motion.div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-muted rounded-full overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full bg-accent-cyan rounded-full"
                    animate={{ width: `${phaseProgress}%` }}
                    transition={{ duration: 0.1, ease: "linear" }}
                  />
                </motion.div>
              )}
            </button>
          );
        })}
      </div>

      {/* Phase label */}
      <div className="mt-4 text-center">
        <span className="text-xs font-semibold tracking-widest uppercase text-accent-cyan">
          Phase {currentPhase} —{" "}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {PHASES[currentPhase - 1]?.label}
        </span>
      </div>
    </motion.div>
  );
}
