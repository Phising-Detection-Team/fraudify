"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Shuffle, Layers, Play, RotateCcw, CheckCircle2 } from "lucide-react";
import { SentraMascot } from "./SentraMascot";

const SPLIT_DATA = [
  { name: "Train",      value: 80, count: "~40,800", color: "hsl(var(--accent-cyan))"   },
  { name: "Validation", value: 10, count: "~5,100",  color: "hsl(var(--accent-purple))" },
  { name: "Test",       value: 10, count: "~5,100",  color: "hsl(var(--accent-green))"  },
];

const TOKEN_SAMPLES = [
  "<|im_start|>","<|im_end|>","<|endoftext|>","system","user","assistant",
  "phish","click","urgent","bank","free","win","login","verify",
  "SCAM","LEGIT","verdict","reasoning","conf","idence","json","email",
  "account","password","secure","alert","reward","claim","token","score",
];

const PIPELINE_CONFIG = [
  { label: "Max seq length",   value: "2048 tokens",                     color: "" },
  { label: "Shuffle seed",     value: "42",                              color: "" },
  { label: "Tokenizer",        value: "Qwen2.5 BPE (tiktoken)",          color: "text-accent-cyan" },
  { label: "Padding strategy", value: "Right-pad (causal LM)",           color: "" },
  { label: "Data format",      value: "Instruction-response SFT",        color: "" },
  { label: "Chat template",    value: "<|im_start|>...<|im_end|>",       color: "text-accent-green" },
];

interface PhaseProps { autoPlay: boolean; phaseProgress: number; wasCompleted?: boolean; onComplete?: () => void; }

// ── Card data ──────────────────────────────────────────────────────────────────
const ENRON_DECK = [
  { text: "Re: Q3 Budget",   sub: '{"verdict":"LEGITIMATE"}' },
  { text: "Meeting 3pm",     sub: '{"verdict":"LEGITIMATE"}' },
  { text: "FWD: TPS Report", sub: '{"verdict":"LEGITIMATE"}' },
];
const PHISH_DECK = [
  { text: "URGENT: Verify!", sub: '{"verdict":"SCAM"}' },
  { text: "Win $500 NOW",    sub: '{"verdict":"SCAM"}' },
  { text: "Claim Reward →",  sub: '{"verdict":"SCAM"}' },
];

// 6 interleaved shuffle cards (alternating E/P)
const SHUFFLE_CARDS = [
  { text: "Re: Q3 Budget",   sub: '{"verdict":"LEGITIMATE"}', isLeft: true,  color: "hsl(var(--accent-cyan))"   },
  { text: "URGENT: Verify!", sub: '{"verdict":"SCAM"}',       isLeft: false, color: "hsl(var(--accent-purple))" },
  { text: "Meeting 3pm",     sub: '{"verdict":"LEGITIMATE"}', isLeft: true,  color: "hsl(var(--accent-cyan))"   },
  { text: "Win $500 NOW",    sub: '{"verdict":"SCAM"}',       isLeft: false, color: "hsl(var(--accent-purple))" },
  { text: "FWD: TPS Report", sub: '{"verdict":"LEGITIMATE"}', isLeft: true,  color: "hsl(var(--accent-cyan))"   },
  { text: "Claim Reward →",  sub: '{"verdict":"SCAM"}',       isLeft: false, color: "hsl(var(--accent-purple))" },
];

// Fan spread at center (shufflePhase 3)
const SPREAD = [
  { x: -64, y:  6, r: -30 },
  { x: -38, y: -6, r: -15 },
  { x: -13, y: -11, r: -4 },
  { x:  13, y: -7, r:   6 },
  { x:  38, y:  3, r:  17 },
  { x:  64, y: 13, r:  28 },
];

// Collapsed stack (shufflePhase 4)
const STACK = [
  { x: -3, y: -10, r: -5 },
  { x: -2, y: -6,  r: -2 },
  { x:  0, y: -3,  r:  0 },
  { x:  2, y:  0,  r:  2 },
  { x:  3, y:  3,  r:  4 },
  { x:  4, y:  6,  r:  6 },
];

const DECK_X = 110; // px from center to each deck

// ── Fireworks burst on dataset reveal ─────────────────────────────────────────
const FW_DOTS = Array.from({ length: 30 }, (_, i) => {
  const angle = (i / 30) * Math.PI * 2;
  const r = 50 + (i % 5) * 14;
  const COLORS = ['#22D3EE','#A855F7','#4ADE80','#FCD34D','#F87171','#FB923C','#60A5FA'];
  return {
    tx: Math.cos(angle) * r,
    ty: Math.sin(angle) * r,
    color: COLORS[i % COLORS.length],
    size: 4 + (i % 4) * 1.5,
    delay: (i % 7) * 0.045,
  };
});

function Fireworks() {
  return (
    <div style={{ position:"absolute", top:"45%", left:"50%", zIndex:35, pointerEvents:"none" }}>
      {[0,1,2].map(i => (
        <motion.div key={`ring-${i}`}
          style={{ position:"absolute", borderRadius:"50%", border:`2.5px solid ${['#22D3EE','#A855F7','#FCD34D'][i]}`, transform:"translate(-50%,-50%)" }}
          initial={{ width:0, height:0, opacity:0.95 }}
          animate={{ width:90+i*38, height:90+i*38, opacity:0 }}
          transition={{ duration:0.72, delay:i*0.17, ease:"easeOut" }}
        />
      ))}
      {FW_DOTS.map((p,i) => (
        <motion.div key={i}
          style={{ position:"absolute", width:p.size, height:p.size, borderRadius:"50%", background:p.color, boxShadow:`0 0 ${p.size*2}px ${p.color}`, transform:"translate(-50%,-50%)" }}
          initial={{ x:0, y:0, opacity:1, scale:0.5 }}
          animate={{ x:p.tx, y:p.ty, opacity:[1,0.85,0], scale:[0.5,1.5,0.2] }}
          transition={{ duration:1.05, delay:p.delay, ease:"easeOut" }}
        />
      ))}
    </div>
  );
}

// ── Mini email card ────────────────────────────────────────────────────────────
function MiniEmailCard({ text, sub, color, width = 68 }: {
  text: string; sub: string; color: string; width?: number;
}) {
  const isPhish = sub.includes("⚠");
  return (
    <div style={{
      width,
      height: Math.round(width * 1.3),
      background: `color-mix(in srgb, ${color} 10%, #0B0B14)`,
      border: `1.5px solid color-mix(in srgb, ${color} 50%, transparent)`,
      borderRadius: 8,
      padding: "7px 7px 5px",
      display: "flex",
      flexDirection: "column",
      gap: 3,
      boxShadow: `0 6px 18px rgba(0,0,0,0.45), 0 0 10px color-mix(in srgb, ${color} 20%, transparent)`,
    }}>
      {/* Header dot + line */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}/>
        <div style={{ flex: 1, height: 1.5, background: `color-mix(in srgb, ${color} 45%, transparent)`, borderRadius: 2 }}/>
      </div>
      {/* Placeholder lines */}
      <div style={{ height: 1.5, background: `color-mix(in srgb, ${color} 28%, transparent)`, borderRadius: 2, width: "80%" }}/>
      <div style={{ height: 1.5, background: `color-mix(in srgb, ${color} 18%, transparent)`, borderRadius: 2, width: "60%" }}/>
      {/* Subject text */}
      <div style={{
        fontSize: Math.max(6, width * 0.095),
        fontFamily: "monospace",
        color,
        fontWeight: 700,
        lineHeight: 1.3,
        marginTop: 1,
        flex: 1,
        wordBreak: "break-word",
      }}>
        {text}
      </div>
      {/* Label badge */}
      <div style={{
        fontSize: Math.max(5.5, width * 0.082),
        fontFamily: "monospace",
        color:      isPhish ? "#F87171" : "#4ADE80",
        background: isPhish ? "rgba(248,113,113,0.14)" : "rgba(74,222,128,0.12)",
        border:     `1px solid ${isPhish ? "rgba(248,113,113,0.35)" : "rgba(74,222,128,0.3)"}`,
        borderRadius: 3,
        padding: "1px 4px",
        textAlign: "center",
        fontWeight: 700,
      }}>
        {sub}
      </div>
    </div>
  );
}

// ── Stacked card deck ──────────────────────────────────────────────────────────
function CardDeck({ cards, color, label, visible, side }: {
  cards: { text: string; sub: string }[];
  color: string;
  label: string;
  visible: boolean;
  side: "left" | "right";
}) {
  const dir = side === "left" ? 1 : -1;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.35, x: dir * -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.2, x: dir * -40, transition: { duration: 0.3 } }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ position: "relative", width: 68, height: 96 }}
        >
          {cards.map((card, i) => (
            <motion.div
              key={i}
              style={{
                position: "absolute",
                top:      (2 - i) * 5,
                left:     (2 - i) * dir * -4,
                transform: `rotate(${(i - 1) * dir * -5}deg)`,
                zIndex:   i,
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.2 + i * 0.35, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
            >
              <MiniEmailCard text={card.text} sub={card.sub} color={color} />
            </motion.div>
          ))}
          {/* Deck label */}
          <div style={{
            position:   "absolute",
            bottom:     -22,
            left:       "50%",
            transform:  "translateX(-50%)",
            fontSize:   8,
            fontFamily: "monospace",
            fontWeight: 800,
            color,
            letterSpacing: "1px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Token rain background ──────────────────────────────────────────────────────
function TokenRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    interface Drop { x: number; y: number; speed: number; text: string; opacity: number; size: number; }
    const drops: Drop[] = Array.from({ length: 40 }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      speed:   Math.random() * 1.4 + 0.3,
      text:    TOKEN_SAMPLES[Math.floor(Math.random() * TOKEN_SAMPLES.length)],
      opacity: Math.random() * 0.45 + 0.08,
      size:    Math.random() > 0.7 ? 13 : 10,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of drops) {
        ctx.font      = `${d.size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = `rgba(0,209,255,${d.opacity})`;
        ctx.fillText(d.text, d.x, d.y);
        d.y += d.speed;
        if (d.y > canvas.height + 20) {
          d.y    = -20;
          d.x    = Math.random() * canvas.width;
          d.text = TOKEN_SAMPLES[Math.floor(Math.random() * TOKEN_SAMPLES.length)];
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-xl"
      style={{ opacity: active ? 1 : 0, transition: "opacity 0.5s" }}
    />
  );
}

function AnimatedCounter({ target, active }: { target: number; active: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    const dur = 1800;
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);
  return <>{val.toLocaleString()}</>;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Phase1Data({ autoPlay, wasCompleted, onComplete }: PhaseProps) {
  const [stage, setStage]               = useState(0);
  const [playing, setPlaying]           = useState(false);
  const [mergeFlash, setFlash]          = useState(false);
  const [shufflePhase, setShufflePhase] = useState<0|1|2|3|4|5>(0);
  const timers                          = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startPlay = () => {
    setStage(0); setPlaying(true); setFlash(false); setShufflePhase(0);
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => { setStage(1); setShufflePhase(1); }, 400),    // info cards slide in
      setTimeout(() => setShufflePhase(2), 1800),                      // fold into card decks
      setTimeout(() => setShufflePhase(3), 3000),                      // cards fly to center + fan
      setTimeout(() => setShufflePhase(4), 4500),                      // collapse into stack
      setTimeout(() => { setShufflePhase(5); setStage(2); }, 5300),   // merged card + token rain
      setTimeout(() => { setStage(3); setFlash(true); onComplete?.(); }, 7000),
    ];
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setStage(0); setPlaying(false); setFlash(false); setShufflePhase(0);
  };

  useEffect(() => {
    if (wasCompleted) {
      setStage(3); setFlash(true); setShufflePhase(5); setPlaying(true);
    } else if (autoPlay) {
      startPlay();
    }
    return () => timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, wasCompleted]);

  return (
    <div className="space-y-6">
      {/* Sentra Mascot */}
      <SentraMascot phase={1} active={stage >= 1} instant={wasCompleted} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database size={20} className="text-accent-cyan" />
            Data Pipeline
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Two phishing datasets merge into one — 51K shuffled samples
          </p>
        </div>
        <div className="flex gap-2">
          {playing && (
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/60 hover:bg-muted transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          )}
          {!playing && (
            <button onClick={startPlay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-accent-cyan/40 bg-accent-cyan/5 text-accent-cyan hover:bg-accent-cyan/10 transition-colors">
              <Play size={12} /> Play Phase
            </button>
          )}
        </div>
      </div>

      {/* ── Main shuffle animation stage ───────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-background/30 backdrop-blur-sm"
        style={{ height: 300 }}
      >
        <TokenRain active={stage >= 2} />

        {/* ── Phase 1: Info cards slide in from sides ─────────────────────── */}
        {/* Each card gets its own AnimatePresence; the motion.div spans full height
            and uses flex centering — no transform conflicts with Framer Motion */}
        <AnimatePresence>
          {shufflePhase === 1 && (
            <motion.div
              key="enron-col"
              initial={{ x: -90, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ position: "absolute", top: 0, bottom: 0, left: 14, width: "min(200px,34%)", display: "flex", alignItems: "center", zIndex: 10 }}
            >
              <div className="glass-panel rounded-xl p-4 border-accent-cyan/25 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                  <div className="text-[9px] font-bold uppercase tracking-wider text-accent-cyan">HuggingFace · Dataset 1</div>
                </div>
                <h3 className="font-bold text-xs mb-0.5">SetFit/enron_spam</h3>
                <p className="text-[10px] text-muted-foreground mb-3">Corporate email spam dataset</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Rows</span>
                    <span className="font-mono font-semibold text-accent-cyan">~33,000</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-mono">Parquet</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">legit</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">spam</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {shufflePhase === 1 && (
            <motion.div
              key="phish-col"
              initial={{ x: 90, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              style={{ position: "absolute", top: 0, bottom: 0, right: 14, width: "min(200px,34%)", display: "flex", alignItems: "center", zIndex: 10 }}
            >
              <div className="glass-panel rounded-xl p-4 border-accent-purple/25 w-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-accent-purple animate-pulse" />
                  <div className="text-[9px] font-bold uppercase tracking-wider text-accent-purple">HuggingFace · Dataset 2</div>
                </div>
                <h3 className="font-bold text-xs mb-0.5">ealvaradob/phishing</h3>
                <p className="text-[10px] text-muted-foreground mb-3">Phishing URLs &amp; emails</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Rows</span>
                    <span className="font-mono font-semibold text-accent-purple">~18,000</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-mono">HF Hub</span>
                  </div>
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">legit</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">phish</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase 2 bridge: info cards fold → deck indicator ──────────── */}
        {shufflePhase === 2 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 15 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ scaleX: [1, 1.18, 1] }}
                transition={{ duration: 0.65, repeat: Infinity, ease: "easeInOut" }}
                style={{ fontSize: 20, lineHeight: 1.2 }}
              >
                <span className="text-accent-cyan">⟶</span>
                <span style={{ margin: "0 6px", fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)" }}>+</span>
                <span className="text-accent-purple">⟵</span>
              </motion.div>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", marginTop: 6 }}
              >
                loading into decks...
              </motion.div>
            </motion.div>
          </div>
        )}

        {/* ── Left deck (Enron) — appears phase 2-3 ───────────────────────── */}
        <div style={{ position: "absolute", top: "50%", left: `calc(50% - ${DECK_X + 34}px)`, transform: "translateY(-50%)", zIndex: 15 }}>
          <CardDeck
            cards={ENRON_DECK}
            color="hsl(var(--accent-cyan))"
            label="Enron ×33K"
            visible={shufflePhase >= 2 && shufflePhase <= 3}
            side="left"
          />
        </div>

        {/* ── Right deck (Phishing) — appears phase 2-3 ──────────────────── */}
        <div style={{ position: "absolute", top: "50%", right: `calc(50% - ${DECK_X + 34}px)`, transform: "translateY(-50%)", zIndex: 15 }}>
          <CardDeck
            cards={PHISH_DECK}
            color="hsl(var(--accent-purple))"
            label="Phish ×18K"
            visible={shufflePhase >= 2 && shufflePhase <= 3}
            side="right"
          />
        </div>

        {/* ── Phase 3-4: Flying + fanned/stacked cards at center ──────────── */}
        {(shufflePhase === 3 || shufflePhase === 4) && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 25 }}>
            {SHUFFLE_CARDS.map((card, i) => {
              const target = shufflePhase === 3 ? SPREAD[i] : STACK[i];
              return (
                <motion.div
                  key={i}
                  style={{ position: "absolute", top: 0, left: 0 }}
                  initial={{
                    x:       card.isLeft ? -DECK_X : DECK_X,
                    y:       (i % 3) * -3,
                    rotate:  card.isLeft ? -28 : 28,
                    opacity: 0,
                    scale:   0.55,
                  }}
                  animate={{
                    x:       target.x,
                    y:       target.y,
                    rotate:  target.r,
                    opacity: 1,
                    scale:   1,
                  }}
                  transition={{
                    delay:     shufflePhase === 3 ? i * 0.17 : 0,
                    duration:  0.7,
                    type:      "spring",
                    stiffness: 85,
                    damping:   14,
                  }}
                >
                  <MiniEmailCard text={card.text} sub={card.sub} color={card.color} />
                </motion.div>
              );
            })}

            {/* Shuffle label below fan */}
            <AnimatePresence>
              {shufflePhase === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ position: "absolute", top: 96, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 5 }}
                >
                  <motion.span
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}
                  >
                    ↙ shuffling with seed = 42 ↘
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Fireworks burst ─────────────────────────────────────────────── */}
        {shufflePhase >= 5 && <Fireworks />}

        {/* ── Phase 5: Merged SENTRA DATASET card springs up ──────────────── */}
        {/* Plain wrapper for centering — avoids transform conflict with Framer Motion */}
        {shufflePhase >= 5 && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, pointerEvents: "none" }}>
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.65, type: "spring", stiffness: 240, damping: 16 }}
              className="glass-panel rounded-xl text-center"
              style={{
                padding:      "18px 26px",
                border:       "1.5px solid rgba(168,85,247,0.5)",
                boxShadow:    "0 0 60px rgba(147,51,234,0.4), 0 0 20px rgba(0,209,255,0.15), 0 8px 32px rgba(0,0,0,0.6)",
                minWidth:     180,
                pointerEvents:"auto",
              }}
            >
              <motion.div
                animate={{ rotate: [0, 22, -22, 0] }}
                transition={{ duration: 0.65, delay: 0.3 }}
              >
                <Shuffle size={22} className="text-accent-purple mx-auto mb-2" />
              </motion.div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", color: "hsl(var(--accent-purple))", marginBottom: 4 }}>
                SENTRA Dataset
              </div>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: "hsl(var(--accent-purple))", lineHeight: 1 }}
              >
                ~51K
              </motion.div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                seed = 42 · merged ✓
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 99, background: "rgba(34,211,238,0.12)", color: "hsl(var(--accent-cyan))", border: "1px solid rgba(34,211,238,0.3)" }}>
                  33K Enron
                </span>
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 99, background: "rgba(168,85,247,0.12)", color: "hsl(var(--accent-purple))", border: "1px solid rgba(168,85,247,0.3)" }}>
                  18K Phish
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Merge success banner ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "backOut" }}
            className="flex items-center gap-3 p-3 rounded-xl bg-accent-green/10 border border-accent-green/30"
          >
            <motion.div
              animate={{ rotate: mergeFlash ? [0, 360] : 0 }}
              transition={{ duration: 0.6 }}
            >
              <CheckCircle2 size={18} className="text-accent-green" />
            </motion.div>
            <div className="flex-1 text-sm">
              <span className="font-semibold text-accent-green">Merge complete — </span>
              <span className="text-muted-foreground text-xs">
                <AnimatedCounter target={51000} active={mergeFlash} /> samples · shuffled with seed=42 · ready for tokenization
              </span>
            </div>
            <div className="text-[10px] font-mono text-accent-green/60">33K + 18K</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Train / Val / Test split ────────────────────────────────────────────── */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="glass-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Layers size={16} className="text-accent-cyan" />
                <h3 className="font-semibold text-sm">Dataset Split  (80 / 10 / 10)</h3>
              </div>
              <div className="space-y-4">
                {SPLIT_DATA.map((d, i) => (
                  <div key={d.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold" style={{ color: d.color }}>{d.name}</span>
                      <div className="flex gap-3">
                        <span className="text-muted-foreground font-mono">{d.count}</span>
                        <span className="font-bold font-mono" style={{ color: d.color }}>{d.value}%</span>
                      </div>
                    </div>
                    <div className="h-6 bg-muted/30 rounded-lg overflow-hidden">
                      <motion.div
                        className="h-full rounded-lg flex items-center justify-end pr-2"
                        style={{ background: d.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${d.value}%` }}
                        transition={{ delay: i * 0.25 + 0.2, duration: 1.0, ease: "easeOut" }}
                      >
                        <span className="text-[10px] font-bold text-background/90 font-mono">{d.value}%</span>
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex h-3 rounded-full overflow-hidden gap-px">
                {SPLIT_DATA.map((d, i) => (
                  <motion.div
                    key={d.name}
                    style={{ background: d.color }}
                    initial={{ flex: 0 }}
                    animate={{ flex: d.value }}
                    transition={{ delay: i * 0.15 + 0.8, duration: 0.8, ease: "easeOut" }}
                    className="rounded-full"
                  />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1.5">
                <span>Train (80%)</span><span>Val</span><span>Test</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4">Pipeline Config</h3>
              <div className="space-y-2.5">
                {PIPELINE_CONFIG.map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 + 0.3 }}
                    className="flex justify-between items-center text-xs border-b border-border/20 pb-2 last:border-0"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-mono font-semibold ${row.color || "text-foreground"}`}>{row.value}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {SPLIT_DATA.map(d => (
                  <motion.div
                    key={d.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="text-center p-2 rounded-lg border border-border/30"
                    style={{ background: `${d.color}10` }}
                  >
                    <div className="text-[10px] text-muted-foreground">{d.name}</div>
                    <div className="text-xs font-bold font-mono mt-0.5" style={{ color: d.color }}>{d.count}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
