"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Play, RotateCcw, Zap, HelpCircle } from "lucide-react";
import { SentraMascot } from "./SentraMascot";

interface PhaseProps { autoPlay: boolean; phaseProgress: number; wasCompleted?: boolean; onComplete?: () => void; }

const GRID_COLS = 14;
const GRID_ROWS = 10;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;

const NF4_LEVELS = [
  -1.0, -0.6962, -0.5251, -0.3949, -0.2844, -0.1848, -0.0911, 0,
   0.0796, 0.1609, 0.2461, 0.3379, 0.4407, 0.5626, 0.7229, 1.0,
];
const INT4_LEVELS = Array.from({ length: 16 }, (_, i) => -1 + (2 / 15) * i);

const FORMAT_ROWS = [
  { fmt: "FP32",  bits: 32, bytes: 4,   range: "±3.4×10³⁸",    use: "Base model weights",     active: false },
  { fmt: "BF16",  bits: 16, bytes: 2,   range: "±3.4×10³⁸",    use: "Compute dtype (Sentra)", active: true  },
  { fmt: "INT8",  bits: 8,  bytes: 1,   range: "[-128, 127]",   use: "LLM.int8() quant",       active: false },
  { fmt: "NF4",   bits: 4,  bytes: 0.5, range: "16 normal pts", use: "Weight storage (Sentra ✓)", active: true  },
];

// Pre-generated weight values (deterministic using seeded pattern)
const WEIGHTS = Array.from({ length: TOTAL_CELLS }, (_, i) =>
  Math.sin(i * 2.399 + 0.5) * 1.8 + Math.cos(i * 0.711) * 0.6
);

function quantizeToNF4(w: number): number {
  const clipped = Math.max(-1, Math.min(1, w / 2));
  return NF4_LEVELS.reduce((a, b) => Math.abs(b - clipped) < Math.abs(a - clipped) ? b : a);
}

function fp32Hue(w: number): string {
  const t = (w + 2.4) / 4.8;
  const h = t * 240;
  return `hsl(${h}, 78%, 55%)`;
}

function nf4Hue(level: number): string {
  const idx = NF4_LEVELS.indexOf(level);
  const h = (idx / 16) * 260 + 15;
  return `hsl(${h}, 82%, 52%)`;
}

/* ── Bit strip with collapse animation ───────────────────────── */
function BitStrip({ bits, label, color, delay = 0 }: { bits: number[]; label: string; color: string; delay?: number }) {
  return (
    <div>
      <div className={`text-[10px] font-bold mb-1.5 font-mono ${color}`}>{label}</div>
      <div className="flex gap-0.5 flex-wrap">
        {bits.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: delay + i * 0.018, duration: 0.25, ease: "backOut" }}
            className={`w-3 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold border ${
              b === 1
                ? `${color.replace("text-", "bg-")}/60 border-current text-white`
                : "bg-muted/60 border-border/40 text-muted-foreground"
            }`}
          >
            {b}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Number line showing quantization levels ─────────────────── */
function QuantLevels({ levels, color, label }: { levels: number[]; color: string; label: string }) {
  return (
    <div>
      <div className={`text-[10px] font-semibold mb-2 ${color}`}>{label}</div>
      <div className="relative h-6 bg-muted rounded-full overflow-hidden">
        <div className="absolute inset-0 flex items-center px-1">
          <div className="w-full h-px bg-border" />
        </div>
        {levels.map((v, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`absolute top-0 bottom-0 w-0.5 ${color.replace("text-", "bg-")}`}
            style={{ left: `${((v + 1) / 2) * 100}%` }}
          >
            <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${color.replace("text-", "bg-")}`} />
          </motion.div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>-1.0</span><span>0.0</span><span>+1.0</span>
      </div>
    </div>
  );
}

/* ── Weight distribution histogram ──────────────────────────── */
function WeightHistogram({ showNF4 }: { showNF4: boolean }) {
  const heights = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => {
      const x = -2.5 + (5 / 40) * i;
      return Math.exp(-0.5 * x * x) * 100 * (1 + Math.sin(i * 1.3) * 0.05);
    });
  }, []);
  const maxH = Math.max(...heights);
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-2">
        Weight value distribution — most cluster near 0, NF4 is denser there
      </div>
      <div className="flex items-end gap-px h-16 bg-muted/30 rounded-lg px-2 pt-2">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm transition-colors duration-500"
            style={{ height: `${(h / maxH) * 100}%`, backgroundColor: showNF4 ? `hsl(var(--accent-purple)/${0.4 + 0.6 * (h/maxH)})` : `hsl(var(--accent-cyan)/${0.4 + 0.6 * (h/maxH)})` }}
          />
        ))}
      </div>
      {showNF4 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {NF4_LEVELS.map((v, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="text-[9px] px-1.5 py-0.5 rounded bg-accent-purple/15 border border-accent-purple/30 text-accent-purple font-mono">
              {v.toFixed(3)}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function Phase2QLoRA({ autoPlay, wasCompleted, onComplete }: PhaseProps) {
  const [stage, setStage]           = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [showNF4Levels, setNF4]     = useState(false);
  const [selectedFmt, setSelectedFmt] = useState<string | null>(null);
  const [bitMode, setBitMode]       = useState<"fp32" | "nf4">("fp32");
  // Scan animation state
  const [scanCol, setScanCol]       = useState(-1);
  const [scanDone, setScanDone]     = useState(false);
  const [compressionFlash, setFlash] = useState(false);
  const timers                      = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scanRef                     = useRef<ReturnType<typeof setInterval>>();

  const scanProgress = scanDone ? 1 : scanCol >= 0 ? scanCol / GRID_COLS : 0;
  const memMB = Math.round(520 - scanProgress * 390);

  const NF4_BITS  = [0, 1, 1, 0];
  const FP32_BITS = [0,0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0];

  const startScan = () => {
    clearInterval(scanRef.current);
    setScanCol(0);
    setScanDone(false);
    setFlash(false);
    let col = 0;
    scanRef.current = setInterval(() => {
      col++;
      if (col >= GRID_COLS) {
        clearInterval(scanRef.current);
        setScanDone(true);
        setFlash(true);
        timers.current.push(setTimeout(() => { setStage(5); onComplete?.(); }, 600));
      } else {
        setScanCol(col);
      }
    }, 460);
  };

  const startPlay = () => {
    timers.current.forEach(clearTimeout);
    clearInterval(scanRef.current);
    setStage(0); setNF4(false); setSelectedFmt(null); setBitMode("fp32");
    setScanCol(-1); setScanDone(false); setFlash(false); setPlaying(true);

    timers.current.push(setTimeout(() => setStage(1), 400));   // bit viz
    timers.current.push(setTimeout(() => setStage(2), 4000));  // format table
    timers.current.push(setTimeout(() => setStage(3), 7500));  // NF4 levels
    timers.current.push(setTimeout(() => setNF4(true), 9000));
    timers.current.push(setTimeout(() => setBitMode("nf4"), 9500));
    timers.current.push(setTimeout(() => {
      setStage(4);
      timers.current.push(setTimeout(startScan, 1200)); // slight delay before scan starts
    }, 11500));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    clearInterval(scanRef.current);
    setStage(0); setNF4(false); setSelectedFmt(null); setBitMode("fp32");
    setScanCol(-1); setScanDone(false); setFlash(false); setPlaying(false);
  };

  useEffect(() => {
    if (wasCompleted) {
      setStage(5); setNF4(true); setBitMode("nf4");
      setScanDone(true); setFlash(true); setPlaying(true);
    } else if (autoPlay) {
      startPlay();
    }
    return () => {
      const t = timers.current;
      t.forEach(clearTimeout);
      clearInterval(scanRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, wasCompleted]);

  const CONFIG_PILLS = [
    { label: "load_in_4bit = True",              color: "accent-cyan"   },
    { label: 'bnb_4bit_quant_type = "nf4"',      color: "accent-purple" },
    { label: "bnb_4bit_use_double_quant = True",  color: "accent-green"  },
    { label: "bnb_4bit_compute_dtype = bfloat16", color: "accent-red"    },
  ];

  return (
    <div className="space-y-6">
      {/* Sentra Mascot */}
      <SentraMascot phase={2} active={stage >= 1} instant={wasCompleted} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Cpu size={20} className="text-accent-cyan" />
            QLoRA Setup
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quantizing 66M DistilBERT weights from FP32 → 4-bit NF4 — cutting GPU memory 4×
          </p>
        </div>
        <div className="flex gap-2">
          {playing && <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:bg-muted transition-colors"><RotateCcw size={12} /> Reset</button>}
          {!playing && <button onClick={startPlay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-accent-cyan/40 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/10 transition-colors"><Play size={12} /> Play Phase</button>}
        </div>
      </div>

      {/* ── Stage 1: Bit representation ── */}
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="ml-auto flex rounded-lg overflow-hidden border border-border/50">
                {(["fp32","nf4"] as const).map(m => (
                  <button key={m} onClick={() => setBitMode(m)}
                    className={`px-3 py-1 text-xs font-mono font-semibold transition-colors ${bitMode === m ? "bg-accent-cyan/20 text-accent-cyan" : "text-muted-foreground hover:bg-muted"}`}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="wait">
                {bitMode === "fp32" ? (
                  <motion.div key="fp32" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                    <BitStrip bits={FP32_BITS.slice(0,1)}   label="Sign (1 bit)"      color="text-accent-red"    delay={0}    />
                    <BitStrip bits={FP32_BITS.slice(1,9)}   label="Exponent (8 bits)" color="text-amber-400"     delay={0.05} />
                    <BitStrip bits={FP32_BITS.slice(9,32)}  label="Mantissa (23 bits)" color="text-accent-cyan"  delay={0.2}  />
                    <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <strong className="text-foreground">32 bits = 4 bytes</strong>  ·  Range: ±3.4×10³⁸  ·  Virtually no rounding error
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="nf4" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                    {/* Dramatic collapse: bits "dissolve" from 32 → 4 */}
                    <div className="relative">
                      <div className="text-[10px] font-bold mb-1.5 font-mono text-accent-purple">NF4 (4 bits — index into 16 quantile levels)</div>
                      <div className="flex gap-0.5 flex-wrap mb-2">
                        {/* Show the 4 actual NF4 bits */}
                        {NF4_BITS.map((b, i) => (
                          <motion.div key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.4, opacity: 1 }}
                            transition={{ delay: i * 0.12, duration: 0.4, ease: "backOut" }}
                            className={`w-5 h-6 rounded flex items-center justify-center text-[10px] font-bold border-2 border-accent-purple/60 ${
                              b === 1 ? "bg-accent-purple/60 text-white" : "bg-muted text-muted-foreground"
                            }`}>
                            {b}
                          </motion.div>
                        ))}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                          className="ml-3 flex items-center gap-1 text-xs text-accent-cyan font-mono font-bold">
                          = index 6 →  level <span className="text-accent-purple ml-1">-0.091</span>
                        </motion.div>
                      </div>
                      {/* Faded "ghost" of the 28 missing bits */}
                      <div className="flex gap-0.5 flex-wrap opacity-20">
                        {Array.from({ length: 28 }, (_, i) => (
                          <motion.div key={i} initial={{ opacity: 0.5 }} animate={{ opacity: 0 }}
                            transition={{ delay: 0.3 + i * 0.015, duration: 0.3 }}
                            className="w-3 h-4 rounded-sm bg-muted-foreground/40" />
                        ))}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1 italic">↑ 28 bits eliminated per weight</div>
                    </div>
                    <div className="p-2 rounded-lg bg-accent-purple/5 border border-accent-purple/20 text-xs">
                      <div className="font-semibold text-accent-purple mb-1">How NF4 works:</div>
                      <div className="text-muted-foreground space-y-0.5">
                        <div>1. Normalize weights to [-1, 1] using FP32 scale factor</div>
                        <div>2. Map to nearest of <strong>16 pre-computed quantile levels</strong></div>
                        <div>3. Store only the <strong className="text-accent-purple">4-bit index</strong> (0–15)</div>
                        <div>4. Dequantize to BF16 at compute time</div>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <strong className="text-accent-purple">4 bits = 0.5 bytes</strong>  ·  <strong className="text-accent-green">8× smaller</strong> than FP32  ·  Minimal accuracy loss
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bits-per-weight comparison bars */}
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-xs text-muted-foreground mb-1">Bits per weight — visual comparison</div>
                <div className="flex items-end justify-center gap-3">
                  {[
                    { label: "FP32", bits: 32, color: "bg-accent-red/70"    },
                    { label: "FP16", bits: 16, color: "bg-amber-400/70"      },
                    { label: "INT8", bits: 8,  color: "bg-accent-cyan/70"   },
                    { label: "NF4",  bits: 4,  color: "bg-accent-purple/80" },
                  ].map(({ label, bits, color }, i) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono font-bold">{bits}</span>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: bits * 2.5 }}
                        transition={{ delay: i * 0.18, duration: 0.7, ease: "easeOut" }}
                        className={`w-9 rounded-t-sm ${color} ${label === "NF4" ? "ring-2 ring-accent-purple ring-offset-1 ring-offset-background" : ""}`}
                      />
                      <span className={`text-[10px] font-bold ${label === "NF4" ? "text-accent-purple" : "text-muted-foreground"}`}>{label}</span>
                      {label === "NF4" && (
                        <motion.span
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-[9px] text-accent-green font-bold"
                        >Sentra ✓</motion.span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 2: Format comparison table ── */}
      <AnimatePresence>
        {stage >= 2 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={16} className="text-accent-cyan" />
              <h3 className="font-semibold text-sm">Precision Format Comparison</h3>
              <span className="text-[10px] text-muted-foreground ml-1">Click a row to explore</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Format","Bits","Memory/weight","Range","Role in Sentra"].map(h => (
                      <th key={h} className="text-left py-2 text-muted-foreground font-semibold px-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FORMAT_ROWS.map((row, i) => (
                    <motion.tr key={row.fmt}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }}
                      onClick={() => setSelectedFmt(selectedFmt === row.fmt ? null : row.fmt)}
                      className={`border-b border-border/20 cursor-pointer transition-all ${row.active ? "hover:bg-accent-cyan/5" : "hover:bg-muted/30"} ${selectedFmt === row.fmt ? "bg-accent-cyan/8" : ""}`}
                    >
                      <td className="py-2.5 px-1 font-mono font-bold">{row.fmt}</td>
                      <td className="py-2.5 px-1 text-center"><span className={`font-mono font-bold ${row.active ? "text-accent-cyan" : ""}`}>{row.bits}</span></td>
                      <td className="py-2.5 px-1 font-mono">{row.bytes} byte{row.bytes !== 1 ? "s" : ""}</td>
                      <td className="py-2.5 px-1 font-mono text-muted-foreground">{row.range}</td>
                      <td className="py-2.5 px-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.active ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30" : "bg-muted text-muted-foreground"}`}>
                          {row.use}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AnimatePresence>
              {selectedFmt === "NF4" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 rounded-lg bg-accent-purple/5 border border-accent-purple/20 text-xs text-muted-foreground overflow-hidden">
                  <strong className="text-accent-purple">NF4 (Normal Float 4)</strong> was designed for LLM weights which follow a <em>normal (Gaussian) distribution</em>.
                  NF4 places its 16 levels at the <strong>quantile positions</strong> of a normal — denser near zero where most weights live. Far better than uniform INT4.
                </motion.div>
              )}
              {selectedFmt === "BF16" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 rounded-lg bg-accent-cyan/5 border border-accent-cyan/20 text-xs text-muted-foreground overflow-hidden">
                  <strong className="text-accent-cyan">BF16</strong> is used for <em>compute</em>, not storage. NF4 weights are <strong>dequantized to BF16</strong> for each matrix multiplication, then the result feeds the gradient update. Near-FP32 accuracy at BF16 speed.
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 3: NF4 vs INT4 ── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-4">Why NF4 beats INT4 — Quantization Level Distribution</h3>
            <div className="space-y-4">
              <WeightHistogram showNF4={showNF4Levels} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border/40 bg-background/40">
                  <QuantLevels levels={INT4_LEVELS} color="text-accent-red" label="INT4 — linear bins (uniform spacing)" />
                  <div className="mt-2 text-[10px] text-muted-foreground">Equal gaps → wastes bins on rarely-used extremes</div>
                </div>
                <div className="p-3 rounded-lg border border-accent-purple/30 bg-accent-purple/5">
                  <QuantLevels levels={NF4_LEVELS} color="text-accent-purple" label="NF4 — quantile bins (denser at center)" />
                  <div className="mt-2 text-[10px] text-muted-foreground">Levels follow the normal distribution — perfect match</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-r from-accent-purple/10 to-accent-cyan/5 border border-accent-purple/20 text-xs">
                <strong className="text-accent-purple">Double Quantization</strong>
                <span className="text-muted-foreground ml-1">
                  — Each group of 64 weights shares one FP32 scale factor. Sentra uses <code className="mx-1 text-accent-cyan bg-accent-cyan/10 px-1 rounded">bnb_4bit_use_double_quant=True</code>
                  which quantizes those scale factors from FP32 → FP8, saving an extra ~0.37 bits/weight.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 4: Live scan quantization grid ── */}
      <AnimatePresence>
        {stage >= 4 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-accent-cyan" />
                <h3 className="font-semibold text-sm">
                  {!scanDone
                    ? scanCol >= 0 ? "⚡ Quantization in progress..." : "Scanning weight matrix..."
                    : "✓ Quantization complete"}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-mono font-bold transition-colors ${scanDone ? "text-accent-green" : "text-accent-cyan"}`}>
                  {memMB} MB
                </span>
                {!scanDone && scanCol >= 0 && (
                  <span className="text-muted-foreground font-mono">
                    {Math.round(scanProgress * 100)}%
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Grid */}
              <div>
                {/* Start scan button if not started */}
                {scanCol === -1 && !scanDone && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={startScan}
                    className="mb-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-accent-cyan/40 bg-accent-cyan/5 text-accent-cyan text-xs font-semibold hover:bg-accent-cyan/10 transition-colors"
                  >
                    <Zap size={12} /> Start Quantization Scan
                  </motion.button>
                )}

                <div className="relative">
                  {/* Scan beam overlay */}
                  {scanCol >= 0 && !scanDone && (
                    <motion.div
                      className="absolute top-0 bottom-0 w-[7%] pointer-events-none rounded"
                      style={{
                        left: `${(scanCol / GRID_COLS) * 100}%`,
                        background: "linear-gradient(90deg, rgba(147,51,234,0.15), rgba(0,209,255,0.55), rgba(147,51,234,0.15))",
                        boxShadow: "0 0 16px rgba(0,209,255,0.6)",
                        zIndex: 10,
                      }}
                    />
                  )}

                  {/* Weight grid */}
                  <div className="grid gap-1 relative"
                    style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
                  >
                    {WEIGHTS.map((w, i) => {
                      const col = i % GRID_COLS;
                      const isQuantized = scanDone || (scanCol >= 0 && col < scanCol);
                      const isBeam = !scanDone && scanCol === col;
                      const qLevel = quantizeToNF4(w);
                      return (
                        <motion.div
                          key={i}
                          className="aspect-square rounded-sm relative"
                          animate={{
                            backgroundColor: isQuantized ? nf4Hue(qLevel) : fp32Hue(w),
                            scale: isBeam ? 1.1 : 1,
                          }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          title={isQuantized ? `NF4: ${qLevel.toFixed(4)}` : `FP32: ${w.toFixed(4)}`}
                        >
                          {isBeam && (
                            <motion.div
                              className="absolute inset-0 bg-white rounded-sm"
                              animate={{ opacity: [0.5, 0.1, 0.5] }}
                              transition={{ duration: 0.4, repeat: Infinity }}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-accent-cyan/40" />FP32 (rainbow spectrum)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-orange-400" />NF4 (16 discrete levels)
                  </div>
                </div>

                {/* Compression flash effect */}
                <AnimatePresence>
                  {compressionFlash && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 p-2.5 rounded-lg bg-accent-green/15 border border-accent-green/40 text-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 0.5, repeat: 3 }}
                        className="text-accent-green font-bold text-sm"
                      >
                        ⚡ 4× COMPRESSION ACHIEVED
                      </motion.div>
                      <div className="text-[10px] text-accent-green/70 font-mono mt-0.5">520 MB → 130 MB</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Memory stats */}
              <div className="space-y-4">
                {/* Memory bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">GPU Memory</span>
                    <motion.span
                      className={`font-mono font-bold ${scanDone ? "text-accent-green" : "text-accent-cyan"}`}
                      animate={scanDone ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {memMB} MB
                    </motion.span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${100 - scanProgress * 75}%`,
                        background: scanDone
                          ? "linear-gradient(90deg, hsl(var(--accent-green)), hsl(var(--accent-cyan)))"
                          : "linear-gradient(90deg, hsl(var(--accent-cyan)), hsl(var(--accent-purple)))",
                      }}
                    />
                    {/* Scan wave on the bar */}
                    {scanCol >= 0 && !scanDone && (
                      <motion.div
                        className="absolute inset-y-0 w-4 bg-white/30 rounded-full"
                        style={{ left: `${(100 - scanProgress * 75) - 4}%` }}
                        animate={{ opacity: [0.8, 0.3, 0.8] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
                    <span className="text-accent-green font-semibold">NF4 ~130 MB</span>
                    <span>FP32 ~520 MB</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Compression",  val: `${Math.round(scanProgress * 75)}%`,               sub: "memory saved",  color: "text-accent-green"  },
                    { label: "Model size",   val: `${memMB} MB`,                                       sub: "on GPU",        color: "text-accent-cyan"   },
                    { label: "Weights done", val: `${Math.round(scanProgress * 100)}%`,               sub: "quantized",     color: "text-accent-purple" },
                    { label: "Quality",      val: "~98%",                                              sub: "preserved",     color: "text-accent-green"  },
                  ].map(r => (
                    <div key={r.label} className="p-2 rounded-lg bg-background/50 border border-border/30 text-center">
                      <div className="text-[10px] text-muted-foreground">{r.label}</div>
                      <div className={`text-sm font-bold font-mono ${r.color}`}>{r.val}</div>
                      <div className="text-[9px] text-muted-foreground">{r.sub}</div>
                    </div>
                  ))}
                </div>

                {/* NF4 level legend */}
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">NF4 level palette  (16 colors = 16 levels)</div>
                  <div className="flex gap-0.5 flex-wrap">
                    {NF4_LEVELS.map((v, i) => (
                      <div key={i} className="w-4 h-4 rounded-sm" title={v.toFixed(4)}
                        style={{ backgroundColor: nf4Hue(v) }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage 5: Config ── */}
      <AnimatePresence>
        {stage >= 5 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">BitsAndBytesConfig — Sentra&apos;s exact setup</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {CONFIG_PILLS.map((pill, i) => (
                <motion.span key={pill.label}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }}
                  className={`text-xs px-3 py-1.5 rounded-full border font-mono font-medium text-${pill.color} bg-${pill.color}/10 border-${pill.color}/30`}>
                  {pill.label}
                </motion.span>
              ))}
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/40 font-mono text-xs text-muted-foreground leading-relaxed">
              <span className="text-accent-purple">BitsAndBytesConfig</span>(<br />
              &nbsp;&nbsp;load_in_4bit=<span className="text-accent-green">True</span>,&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-muted-foreground/50"># NF4 weight storage</span><br />
              &nbsp;&nbsp;bnb_4bit_quant_type=<span className="text-accent-cyan">&quot;nf4&quot;</span>,&nbsp;&nbsp;&nbsp;<span className="text-muted-foreground/50"># quantile-based, not linear</span><br />
              &nbsp;&nbsp;bnb_4bit_use_double_quant=<span className="text-accent-green">True</span>,&nbsp;<span className="text-muted-foreground/50"># quantize scale factors too</span><br />
              &nbsp;&nbsp;bnb_4bit_compute_dtype=<span className="text-accent-cyan">bfloat16</span>,<span className="text-muted-foreground/50"># dequantize to BF16 for math</span><br />
              &nbsp;&nbsp;llm_int8_skip_modules=[<span className="text-accent-red">&quot;classifier&quot;</span>]&nbsp;<span className="text-muted-foreground/50"># keep head in FP32</span><br />
              )
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
