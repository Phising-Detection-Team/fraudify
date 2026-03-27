"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Narrative text ────────────────────────────────────────────────────────────
const NARRATIVES: Record<number, string> = {
  1: "Beep boop! My creators fed me 50,231 emails — phishing traps, spam, and legit messages — all shuffled with seed 42. They split me into training 80%, validation 10%, and test 10%. Every example sharpened my instincts. This is where I was born! ⚡",
  2: "Whirrrr... They squeezed my weights from 32-bit floats down to just 4 bits using NF4 quantization! Memory shrank from 520 MB to 130 MB — a 4× compression. Like fitting an entire library into a backpack. Efficient. Precise. Still completely me. 🗜️",
  3: "INITIATING LORA PROTOCOL. They froze 99.1% of my core weights — I literally could not change them. Then injected tiny A and B adapter matrices into my 24 attention modules. Only 589,824 free parameters. Small... but mighty. ⚡",
  4: "7,500 steps. 3 epochs. Each batch of 16 emails — I'd read, predict, then AdamW nudged my adapters via cross-entropy loss. Loss fell from 0.65 all the way to 0.08. I could feel myself getting sharper with every gradient update. 🔥",
  5: "MISSION COMPLETE. 97.3% accuracy. F1: 0.973. Uploaded to HuggingFace as sentra-utoledo-v1.0. I guard inboxes everywhere now. Every phishing email that tries to slip past me — I catch it. That is my purpose. That is why I exist. 🛡️",
};

const PHASE_ACCENTS: Record<number, { border: string; rgb: string; label: string }> = {
  1: { border: "#22D3EE", rgb: "34,211,238",   label: "DATA PIPELINE"   },
  2: { border: "#A855F7", rgb: "168,85,247",   label: "QUANTIZATION"    },
  3: { border: "#A855F7", rgb: "168,85,247",   label: "LORA INJECTION"  },
  4: { border: "#4ADE80", rgb: "74,222,128",   label: "TRAINING LOOP"   },
  5: { border: "#FCD34D", rgb: "252,211,77",   label: "DEPLOYED ✦"      },
};


interface SentraMascotProps {
  phase: 1 | 2 | 3 | 4 | 5;
  active: boolean;
  instant?: boolean;
}

// ─── Typing hook ───────────────────────────────────────────────────────────────
function useTyping(text: string, active: boolean, instant: boolean) {
  const [shown, setShown] = useState(instant ? text : "");
  const [done,  setDone]  = useState(instant);
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (instant) { setShown(text); setDone(true); return; }
    if (!active) { setShown(""); setDone(false); return; }
    let i = 0;
    setShown(""); setDone(false);
    const delay = setTimeout(() => {
      intRef.current = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length) { clearInterval(intRef.current!); setDone(true); }
      }, 22);
    }, 700);
    return () => { clearTimeout(delay); if (intRef.current) clearInterval(intRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, instant]);

  return { shown, done };
}

// ─── Color palette ─────────────────────────────────────────────────────────────
const Y  = "#FCD34D";   // front yellow
const YS = "#B45309";   // side yellow (shadow)
const YT = "#FEF9C3";   // top yellow (highlight)
const D  = "#1C1917";   // dark panel
const DM = "#44403C";   // mid dark
const CY = "#00D1FF";   // cyan
const BK = "#0A0A0A";   // outline

// ─── Shared SVG defs (glow + gradient) ────────────────────────────────────────
function SvgDefs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`ey-${id}`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id={`glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id={`fg-${id}`} cx="35%" cy="25%" r="70%">
        <stop offset="0%"   stopColor={YT}/>
        <stop offset="100%" stopColor={Y}/>
      </radialGradient>
      <radialGradient id={`panel-${id}`} cx="30%" cy="20%" r="80%">
        <stop offset="0%"   stopColor="#2A2520"/>
        <stop offset="100%" stopColor={D}/>
      </radialGradient>
    </defs>
  );
}

// ─── Animated mouth (jaw) ──────────────────────────────────────────────────────
function Mouth({ cx, cy, w, isTalking, color = CY }: {
  cx: number; cy: number; w: number; isTalking: boolean; color?: string;
}) {
  return (
    <motion.rect
      x={cx - w / 2}
      y={cy - 2}
      width={w}
      height={4}
      rx={2}
      fill={color}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      animate={isTalking ? {
        scaleY:  [0.4, 1.8, 0.6, 1.5, 0.3, 1.6, 0.5, 1.2, 0.4],
        opacity: [0.7, 1,   0.8, 1,   0.7, 1,   0.8, 1,   0.7],
      } : {
        scaleY:  0.4,
        opacity: 0.5,
      }}
      transition={isTalking
        ? { duration: 0.42, repeat: Infinity, ease: "easeInOut" }
        : { duration: 0.3 }
      }
    />
  );
}

// ─── PHASE 1: Born — V-arms raised, excited, wide eyes ────────────────────────
function RobotP1({ isTalking = false }: { isTalking?: boolean }) {
  const id = "p1";
  return (
    <svg viewBox="0 0 120 200" fill="none" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <SvgDefs id={id}/>
      <ellipse cx="58" cy="195" rx="42" ry="7" fill="rgba(0,0,0,0.4)"/>

      {/* Antenna */}
      <line x1="54" y1="13" x2="54" y2="2" stroke={BK} strokeWidth="2.5" strokeLinecap="round"/>
      <motion.circle cx="54" cy="1.5" r="4.5" fill={CY} filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [4.5,7,4.5] : [4.5,5.5,4.5], opacity:[1,0.6,1] }}
        transition={{ duration: isTalking ? 0.5 : 1.5, repeat:Infinity }}/>

      {/* Head 3D */}
      <path d="M32 13 L45 8 L91 8 L78 13 Z" fill={YT}/>
      <path d="M78 13 L91 8 L91 48 L78 48 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="32" y="13" width="46" height="35" rx="8" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>

      {/* Visor */}
      <rect x="36" y="18" width="36" height="24" rx="6" fill={`url(#panel-${id})`} stroke="#333" strokeWidth="0.5"/>

      {/* Eyes */}
      <motion.circle cx="48" cy="28" r="5.5" fill={CY} filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [5.5,7,5.5] : [5.5,6,5.5], opacity:[1,0.65,1] }}
        transition={{ duration: isTalking ? 0.55 : 1.8, repeat:Infinity }}/>
      <motion.circle cx="64" cy="28" r="5.5" fill={CY} filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [5.5,7,5.5] : [5.5,6,5.5], opacity:[1,0.65,1] }}
        transition={{ duration: isTalking ? 0.55 : 1.8, repeat:Infinity, delay:0.15 }}/>
      <circle cx="49.5" cy="26.5" r="2.2" fill="white"/>
      <circle cx="65.5" cy="26.5" r="2.2" fill="white"/>

      {/* Sparkle crosses */}
      {[[42,18],[71,18]].map(([x,y],i) => (
        <g key={i}>
          <motion.line x1={x} y1={y+3} x2={x} y2={y-1} stroke="white" strokeWidth="1"
            animate={{ opacity:[0.7,0.2,0.7] }} transition={{ duration:2, repeat:Infinity, delay:i*0.4 }}/>
          <motion.line x1={x-2} y1={y+1} x2={x+2} y2={y+1} stroke="white" strokeWidth="1"
            animate={{ opacity:[0.7,0.2,0.7] }} transition={{ duration:2, repeat:Infinity, delay:i*0.4 }}/>
        </g>
      ))}

      {/* Mouth */}
      <Mouth cx={55} cy={38} w={18} isTalking={isTalking} />

      {/* Eye blink overlay */}
      <motion.rect x="36" y="18" width="36" height="24" rx="6" fill={`url(#panel-${id})`} pointerEvents="none"
        animate={{ opacity: [0,0,0,0,0,0,0,1,0,0] }}
        transition={{ duration: 4.5, repeat: Infinity, delay: 2 }}/>

      {/* Cheek blush */}
      <motion.circle cx="35" cy="35" r="5" fill="#FCA5A5"
        animate={{ opacity: isTalking ? [0.4,0.7,0.4] : [0.3,0.4,0.3] }}
        transition={{ duration:0.8, repeat:Infinity }}/>
      <motion.circle cx="75" cy="35" r="5" fill="#FCA5A5"
        animate={{ opacity: isTalking ? [0.4,0.7,0.4] : [0.3,0.4,0.3] }}
        transition={{ duration:0.8, repeat:Infinity, delay:0.1 }}/>

      {/* Neck */}
      <rect x="46" y="47" width="18" height="7" rx="3" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Body */}
      <path d="M20 56 L34 51 L93 51 L79 56 Z" fill={YT} opacity="0.8"/>
      <path d="M79 56 L93 51 L93 110 L79 110 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="20" y="56" width="59" height="54" rx="10" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>

      {/* Chest panel */}
      <rect x="28" y="63" width="43" height="28" rx="6" fill={`url(#panel-${id})`} stroke="#333" strokeWidth="0.5"/>
      <motion.rect x="32" y="68" width="12" height="2.5" rx="1.2" fill={CY}
        animate={{ width: isTalking ? [12,20,12] : [12,12] }}
        transition={{ duration:0.6, repeat:Infinity }}/>
      <rect x="32" y="74" width="22" height="2.5" rx="1.2" fill="#4ADE80"/>
      <motion.rect x="32" y="80" width="8" height="2.5" rx="1.2" fill="#A855F7"
        animate={{ width: isTalking ? [8,16,8] : [8,8] }}
        transition={{ duration:0.5, repeat:Infinity, delay:0.2 }}/>
      <text x="47" y="73" fontSize="7" fill="#FCD34D" fontFamily="monospace" fontWeight="700">51K</text>
      <text x="47" y="79" fontSize="6" fill="#22D3EE" fontFamily="monospace">DATA</text>

      {/* Hip */}
      <rect x="23" y="92" width="53" height="15" rx="5" fill={DM}/>
      <circle cx="34" cy="99" r="3.5" fill={D}/>
      <circle cx="68" cy="99" r="3.5" fill={D}/>

      {/* Left arm — drawn BEFORE shoulder so joint caps it */}
      <motion.g
        animate={{ rotate: isTalking ? [-55,-33,-50,-38,-55] : [-54,-44,-54] }}
        style={{ transformOrigin:"20px 64px" }}
        transition={{ duration: isTalking ? 0.55 : 2.2, repeat:Infinity, ease:"easeInOut" }}>
        <rect x="-5" y="60" width="30" height="11" rx="5.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="-5" cy="65" r="8.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </motion.g>

      {/* Right arm — drawn BEFORE shoulder */}
      <motion.g
        animate={{ rotate: isTalking ? [55,33,50,38,55] : [54,44,54] }}
        style={{ transformOrigin:"79px 64px" }}
        transition={{ duration: isTalking ? 0.55 : 2.2, repeat:Infinity, ease:"easeInOut", delay:0.15 }}>
        <rect x="75" y="60" width="30" height="11" rx="5.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="105" cy="65" r="8.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </motion.g>

      {/* Shoulder joints — drawn AFTER arms so they cap the joints */}
      <circle cx="20" cy="64" r="7.5" fill={DM} stroke={BK} strokeWidth="1.5"/>
      <circle cx="79" cy="64" r="7.5" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Legs */}
      <path d="M53 110 L60 107 L60 136 L53 136 Z" fill={YS}/>
      <rect x="27" y="110" width="26" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="22" y="134" width="32" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
      <path d="M66 110 L73 107 L73 136 L66 136 Z" fill={YS}/>
      <rect x="56" y="110" width="26" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="54" y="134" width="32" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
    </svg>
  );
}

// ─── PHASE 2: Compressed — squint eyes, 4BIT badge, pointing arm ──────────────
function RobotP2({ isTalking = false }: { isTalking?: boolean }) {
  const id = "p2";
  return (
    <svg viewBox="0 0 125 200" fill="none" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <SvgDefs id={id}/>
      <ellipse cx="60" cy="195" rx="42" ry="7" fill="rgba(0,0,0,0.4)"/>

      {/* Antenna bent forward */}
      <path d="M56 13 Q59 8 64 4" stroke={BK} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <motion.circle cx="64" cy="3.5" r="4" fill={CY} filter={`url(#ey-${id})`}
        animate={{ r:[4,5.5,4] }} transition={{ duration:1.2, repeat:Infinity }}/>

      {/* Head */}
      <path d="M30 15 L43 10 L89 10 L76 15 Z" fill={YT}/>
      <path d="M76 15 L89 10 L89 47 L76 47 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="30" y="15" width="46" height="32" rx="8" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
      <rect x="34" y="20" width="36" height="20" rx="5" fill={`url(#panel-${id})`}/>

      {/* Squinting eyes */}
      <motion.rect x="37" y="27" width="11" height="5" rx="2.5" fill={CY} filter={`url(#ey-${id})`}
        animate={{ opacity: isTalking ? [1,0.5,1] : [1,0.7,1], scaleY: isTalking ? [1,0.6,1] : 1 }}
        transition={{ duration: isTalking ? 0.55 : 2, repeat:Infinity }}/>
      <motion.rect x="56" y="27" width="11" height="5" rx="2.5" fill={CY} filter={`url(#ey-${id})`}
        animate={{ opacity: isTalking ? [1,0.5,1] : [1,0.7,1], scaleY: isTalking ? [1,0.6,1] : 1 }}
        transition={{ duration: isTalking ? 0.55 : 2, repeat:Infinity, delay:0.2 }}/>
      <line x1="37" y1="25" x2="48" y2="25" stroke={CY} strokeWidth="1.2" opacity="0.5"/>
      <line x1="56" y1="25" x2="67" y2="25" stroke={CY} strokeWidth="1.2" opacity="0.5"/>

      {/* Eye blink overlay */}
      <motion.rect x="34" y="20" width="36" height="20" rx="5" fill={`url(#panel-${id})`} pointerEvents="none"
        animate={{ opacity: [0,0,0,0,0,0,1,0,0] }}
        transition={{ duration: 5, repeat: Infinity, delay: 2.5 }}/>

      {/* Mouth */}
      <Mouth cx={55} cy={37} w={16} isTalking={isTalking} />

      {/* 4BIT badge */}
      <rect x="48" y="40" width="22" height="7" rx="3" fill="#A855F7"/>
      <text x="50" y="46" fontSize="5.5" fill="white" fontWeight="800" fontFamily="monospace">4-BIT</text>

      {/* Neck */}
      <rect x="45" y="46" width="16" height="7" rx="3" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Body — squishes rhythmically when talking (compression!) */}
      <path d="M18 56 L32 51 L92 51 L78 56 Z" fill={YT} opacity="0.7"/>
      <path d="M78 56 L92 51 L92 106 L78 106 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <motion.rect x="18" y="56" width="60" height="50" rx="10" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"
        style={{ transformOrigin:"48px 81px" }}
        animate={{ scaleY: isTalking ? [1,0.88,1.04,0.93,1] : 1 }}
        transition={{ duration:0.6, repeat:Infinity }}/>
      <rect x="26" y="63" width="44" height="26" rx="6" fill={`url(#panel-${id})`}/>
      <text x="30" y="75" fontSize="11" fill={CY} fontFamily="monospace" fontWeight="800">4BIT</text>
      <motion.text x="30" y="84" fontSize="7" fill="#A855F7" fontFamily="monospace"
        animate={{ opacity: isTalking ? [1,0.5,1] : 1 }}
        transition={{ duration:0.5, repeat:Infinity }}>NF4 ↓</motion.text>

      {/* Compression arrows — more dramatic when talking */}
      <motion.text x="13" y="75" fontSize="12" fill="#4ADE80" fontWeight="800"
        animate={{ y: isTalking ? [75,70,75] : 75, opacity: isTalking ? [1,0.5,1] : 0.7 }}
        transition={{ duration: isTalking ? 0.4 : 0.45, repeat:Infinity }}>↓</motion.text>
      <motion.text x="13" y="87" fontSize="12" fill="#4ADE80" fontWeight="800"
        animate={{ y: isTalking ? [87,92,87] : 87, opacity: isTalking ? [1,0.5,1] : 0.7 }}
        transition={{ duration: isTalking ? 0.4 : 0.45, repeat:Infinity }}>↑</motion.text>

      {/* Hip + shoulders */}
      <rect x="21" y="90" width="54" height="13" rx="5" fill={DM}/>
      <circle cx="18" cy="64" r="7.5" fill={DM} stroke={BK} strokeWidth="1.5"/>
      <circle cx="78" cy="64" r="7.5" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Left arm */}
      <g transform="rotate(55 18 64)">
        <rect x="-4" y="60" width="26" height="10" rx="5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="-4" cy="65" r="7.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </g>

      {/* Right arm — pointing */}
      <rect x="78" y="61" width="34" height="10" rx="5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <ellipse cx="115" cy="66" rx="7" ry="5.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <motion.line x1="118" y1="66" x2="124" y2="66" stroke={BK} strokeWidth="2.5" strokeLinecap="round"
        animate={{ x2: isTalking ? [124,128,124] : [124,127,124] }}
        transition={{ duration: isTalking ? 0.35 : 0.8, repeat:Infinity }}/>

      {/* Legs */}
      <path d="M52 106 L59 103 L59 130 L52 130 Z" fill={YS}/>
      <rect x="26" y="106" width="26" height="26" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="21" y="128" width="32" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
      <path d="M65 106 L72 103 L72 130 L65 130 Z" fill={YS}/>
      <rect x="55" y="106" width="26" height="26" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="53" y="128" width="32" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
    </svg>
  );
}

// ─── PHASE 3: Injected — arms wide, LORA cables, power stance ─────────────────
function RobotP3({ isTalking = false }: { isTalking?: boolean }) {
  const id = "p3";
  return (
    <svg viewBox="0 0 145 205" fill="none" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <SvgDefs id={id}/>
      <ellipse cx="70" cy="198" rx="48" ry="7" fill="rgba(0,0,0,0.4)"/>

      {/* Antenna */}
      <line x1="67" y1="12" x2="67" y2="2" stroke={BK} strokeWidth="2.5" strokeLinecap="round"/>
      <motion.circle cx="67" cy="1.5" r="5" fill="#A855F7" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [5,7.5,5] : [5,6.5,5] }}
        transition={{ duration: isTalking ? 0.5 : 1.2, repeat:Infinity }}/>

      {/* Head */}
      <path d="M43 13 L57 8 L104 8 L90 13 Z" fill={YT}/>
      <path d="M90 13 L104 8 L104 48 L90 48 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="43" y="13" width="47" height="35" rx="9" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
      <rect x="47" y="18" width="37" height="23" rx="6" fill={`url(#panel-${id})`}/>

      {/* Eyes — large, pulsing purple */}
      <motion.circle cx="58" cy="29" r="6.5" fill="#A855F7" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [6.5,9,6.5] : [6.5,7.5,6.5], opacity:[1,0.6,1] }}
        transition={{ duration: isTalking ? 0.55 : 1.5, repeat:Infinity }}/>
      <motion.circle cx="76" cy="29" r="6.5" fill="#A855F7" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [6.5,9,6.5] : [6.5,7.5,6.5], opacity:[1,0.6,1] }}
        transition={{ duration: isTalking ? 0.55 : 1.5, repeat:Infinity, delay:0.2 }}/>
      <circle cx="59.5" cy="27.5" r="2.3" fill="white"/>
      <circle cx="77.5" cy="27.5" r="2.3" fill="white"/>

      {/* Eye blink overlay */}
      <motion.rect x="47" y="18" width="37" height="23" rx="6" fill={`url(#panel-${id})`} pointerEvents="none"
        animate={{ opacity: [0,0,0,0,0,0,1,0,0] }}
        transition={{ duration: 4.8, repeat: Infinity, delay: 1.5 }}/>

      {/* Mouth */}
      <Mouth cx={67} cy={37} w={20} isTalking={isTalking} color="#A855F7" />

      {/* Neck */}
      <rect x="58" y="47" width="18" height="7" rx="3" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Body */}
      <path d="M23 57 L37 52 L105 52 L91 57 Z" fill={YT} opacity="0.8"/>
      <path d="M91 57 L105 52 L105 112 L91 112 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="23" y="57" width="68" height="55" rx="10" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
      <rect x="31" y="64" width="52" height="30" rx="6" fill={`url(#panel-${id})`}/>
      <motion.text x="37" y="78" fontSize="10" fill="#A855F7" fontFamily="monospace" fontWeight="800"
        animate={{ opacity: isTalking ? [1,0.6,1] : 1 }}
        transition={{ duration:0.5, repeat:Infinity }}>LORA ▶</motion.text>
      <text x="37" y="89" fontSize="6.5" fill={CY} fontFamily="monospace">ACTIVE</text>

      {/* Hip */}
      <rect x="26" y="94" width="62" height="15" rx="5" fill={DM}/>

      {/* Left arm — drawn BEFORE shoulder */}
      <motion.g
        animate={{ rotate: isTalking ? [-6, 5, -6] : [-3, 3, -3] }}
        style={{ transformOrigin:"26px 65px" }}
        transition={{ duration: isTalking ? 0.55 : 2.5, repeat:Infinity, ease:"easeInOut" }}>
        <rect x="-9" y="62" width="34" height="10" rx="5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="-9" cy="67" r="8.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </motion.g>
      <motion.path d="M-9 67 Q-20 92 -13 112" fill="none" stroke="#A855F7" strokeWidth="2.5" strokeDasharray="5 3"
        animate={{ strokeDashoffset:[-24,0] }} transition={{ duration: isTalking ? 0.5 : 1, repeat:Infinity, ease:"linear" }}/>
      {/* Left cable sparks */}
      {[-14,0,14].map((dx,i) => (
        <motion.circle key={`ls-${i}`} cx={-13+dx*0.4} cy={112} r={isTalking ? 3 : 2}
          fill="#A855F7" filter={`url(#ey-${id})`}
          animate={{ opacity:[0,1,0], scale:[0,1.8,0], cy:[112,106,112] }}
          transition={{ duration: isTalking ? 0.35 : 0.55, repeat:Infinity, delay:i*0.1 }}/>
      ))}

      {/* Right arm — drawn BEFORE shoulder */}
      <motion.g
        animate={{ rotate: isTalking ? [6, -5, 6] : [3, -3, 3] }}
        style={{ transformOrigin:"91px 65px" }}
        transition={{ duration: isTalking ? 0.55 : 2.5, repeat:Infinity, ease:"easeInOut", delay:0.2 }}>
        <rect x="91" y="62" width="34" height="10" rx="5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="125" cy="67" r="8.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </motion.g>
      <motion.path d="M125 67 Q136 92 129 112" fill="none" stroke="#A855F7" strokeWidth="2.5" strokeDasharray="5 3"
        animate={{ strokeDashoffset:[-24,0] }} transition={{ duration: isTalking ? 0.5 : 1, repeat:Infinity, ease:"linear", delay:0.15 }}/>
      {/* Right cable sparks */}
      {[-14,0,14].map((dx,i) => (
        <motion.circle key={`rs-${i}`} cx={129+dx*0.4} cy={112} r={isTalking ? 3 : 2}
          fill="#A855F7" filter={`url(#ey-${id})`}
          animate={{ opacity:[0,1,0], scale:[0,1.8,0], cy:[112,106,112] }}
          transition={{ duration: isTalking ? 0.35 : 0.55, repeat:Infinity, delay:0.15+i*0.1 }}/>
      ))}

      {/* Shoulder joints — drawn AFTER arms */}
      <circle cx="26" cy="65" r="8.5" fill={DM} stroke={BK} strokeWidth="1.5"/>
      <circle cx="91" cy="65" r="8.5" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Legs — power stance */}
      <path d="M64 112 L72 109 L72 136 L64 136 Z" fill={YS}/>
      <rect x="29" y="112" width="35" height="27" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="23" y="135" width="42" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
      <path d="M82 112 L90 109 L90 136 L82 136 Z" fill={YS}/>
      <rect x="64" y="112" width="35" height="27" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="62" y="135" width="42" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
    </svg>
  );
}

// ─── PHASE 4: Running — tilted stride, motion lines ───────────────────────────
function RobotP4({ isTalking = false }: { isTalking?: boolean }) {
  const id = "p4";
  return (
    <svg viewBox="0 0 135 205" fill="none" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <SvgDefs id={id}/>
      <ellipse cx="64" cy="197" rx="40" ry="7" fill="rgba(0,0,0,0.4)"/>

      {/* Motion lines — more dramatic when talking */}
      {[0,1,2,3].map(i => (
        <motion.line key={i}
          x1={-5} y1={55 + i * 19} x2={22} y2={55 + i * 19}
          stroke="#4ADE80" strokeWidth={isTalking ? 2.8 - i * 0.3 : 2.2 - i * 0.35} strokeLinecap="round"
          animate={{
            x1:      isTalking ? [-5,-26,-5] : [-5,-14,-5],
            x2:      isTalking ? [22, 14, 22] : 22,
            opacity: isTalking ? [0.9,0.3,0.9] : [0.7,0.25,0.7],
          }}
          transition={{ duration: isTalking ? 0.32 : 0.6 + i*0.1, repeat:Infinity, delay:i*0.06 }}
        />
      ))}

      <g transform="rotate(12 66 100)">
        {/* Antenna */}
        <line x1="60" y1="12" x2="55" y2="2" stroke={BK} strokeWidth="2.5" strokeLinecap="round"/>
        <motion.circle cx="54" cy="1.5" r="4" fill={CY}
          animate={{ opacity: isTalking ? [1,0.3,1] : [1,0.5,1] }}
          transition={{ duration: isTalking ? 0.3 : 0.4, repeat:Infinity }}/>

        {/* Head */}
        <path d="M34 13 L47 8 L91 8 L78 13 Z" fill={YT}/>
        <path d="M78 13 L91 8 L91 46 L78 46 Z" fill={YS} stroke={BK} strokeWidth="1"/>
        <rect x="34" y="13" width="44" height="33" rx="8" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
        <rect x="38" y="18" width="34" height="21" rx="5" fill={`url(#panel-${id})`}/>

        {/* Determined angled eyes */}
        <motion.ellipse cx="48" cy="28" rx="5.5" ry={isTalking ? 5 : 4.5} fill={CY} filter={`url(#ey-${id})`}
          animate={{ opacity: isTalking ? [1,0.6,1] : [1,0.8,1] }}
          transition={{ duration: isTalking ? 0.45 : 0.5, repeat:Infinity }}/>
        <motion.ellipse cx="64" cy="28" rx="5.5" ry={isTalking ? 5 : 4.5} fill={CY} filter={`url(#ey-${id})`}
          animate={{ opacity: isTalking ? [1,0.6,1] : [1,0.8,1] }}
          transition={{ duration: isTalking ? 0.45 : 0.5, repeat:Infinity, delay:0.1 }}/>
        <circle cx="49.5" cy="27" r="1.8" fill="white"/>
        <circle cx="65.5" cy="27" r="1.8" fill="white"/>
        <line x1="40" y1="21" x2="50" y2="19" stroke={CY} strokeWidth="1.5" opacity="0.65"/>
        <line x1="58" y1="19" x2="68" y2="21" stroke={CY} strokeWidth="1.5" opacity="0.65"/>
        {/* Eye blink overlay */}
        <motion.rect x="38" y="18" width="34" height="21" rx="5" fill={`url(#panel-${id})`} pointerEvents="none"
          animate={{ opacity: [0,0,0,0,0,1,0,0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 3 }}/>

        {/* Mouth */}
        <Mouth cx={56} cy={35} w={16} isTalking={isTalking} />

        {/* Neck */}
        <rect x="46" y="45" width="16" height="6" rx="3" fill={DM} stroke={BK} strokeWidth="1.5"/>

        {/* Body */}
        <path d="M22 53 L35 48 L91 48 L78 53 Z" fill={YT} opacity="0.7"/>
        <path d="M78 53 L91 48 L91 104 L78 104 Z" fill={YS} stroke={BK} strokeWidth="1"/>
        <rect x="22" y="53" width="56" height="51" rx="9" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
        <rect x="30" y="59" width="40" height="27" rx="5" fill={`url(#panel-${id})`}/>
        <motion.polyline points="33,80 40,72 48,68 56,64 63,61 68,60" stroke="#4ADE80" strokeWidth="1.8" fill="none"
          animate={{ opacity: isTalking ? [1,0.6,1] : 1 }}
          transition={{ duration:0.5, repeat:Infinity }}/>
        <text x="31" y="68" fontSize="5.5" fill="#4ADE80" fontFamily="monospace">LOSS↓</text>

        <rect x="25" y="88" width="50" height="13" rx="5" fill={DM}/>
        <circle cx="35" cy="94" r="3.5" fill={D}/>
        <circle cx="65" cy="94" r="3.5" fill={D}/>
        <circle cx="22" cy="61" r="7" fill={DM} stroke={BK} strokeWidth="1.5"/>
        <circle cx="78" cy="61" r="7" fill={DM} stroke={BK} strokeWidth="1.5"/>

        {/* Running arms */}
        <g transform="rotate(30 22 61)">
          <rect x="-2" y="57" width="28" height="9" rx="4.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
          <circle cx="-2" cy="61" r="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
        </g>
        <g transform="rotate(-40 78 61)">
          <rect x="75" y="57" width="28" height="9" rx="4.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
          <circle cx="103" cy="61" r="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
        </g>

        {/* Running legs */}
        <g transform="rotate(-30 40 104)">
          <rect x="26" y="104" width="26" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
          <rect x="20" y="128" width="30" height="12" rx="5" fill={D} stroke={BK} strokeWidth="1.5"/>
        </g>
        <g transform="rotate(25 62 104)">
          <rect x="56" y="104" width="26" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
          <rect x="54" y="128" width="30" height="12" rx="5" fill={D} stroke={BK} strokeWidth="1.5"/>
        </g>
      </g>
    </svg>
  );
}

// ─── PHASE 5: Triumphant — fist raised, cape, starburst ───────────────────────
function RobotP5({ isTalking = false }: { isTalking?: boolean }) {
  const id = "p5";
  return (
    <svg viewBox="0 0 145 215" fill="none" style={{ width:"100%", height:"100%", overflow:"visible" }}>
      <SvgDefs id={id}/>
      <ellipse cx="67" cy="208" rx="44" ry="7" fill="rgba(0,0,0,0.4)"/>

      {/* Starburst */}
      {Array.from({ length: 12 }, (_, i) => {
        const a  = (i / 12) * Math.PI * 2;
        const r1 = 38, r2 = 28;
        const x1 = 67 + Math.cos(a) * r1, y1 = 29 + Math.sin(a) * r1;
        const a2 = a + Math.PI / 12;
        const x2 = 67 + Math.cos(a2) * r2, y2 = 29 + Math.sin(a2) * r2;
        return (
          <motion.polygon key={i}
            points={`67,29 ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`}
            fill={i % 2 === 0 ? "#FCD34D" : "#FEF9C3"}
            animate={{ scale: isTalking ? [1,1.14,1] : [1,1.07,1], opacity:[0.8,1,0.8] }}
            transition={{ duration: isTalking ? 0.5 : 1.5, repeat:Infinity, delay:i*0.04 }}
            style={{ transformOrigin:"67px 29px" }}
          />
        );
      })}

      {/* Cape */}
      <motion.path d="M46 58 L29 88 L36 145 L46 143 L49 112 Z" fill="#DC2626" stroke={BK} strokeWidth="1.5"
        animate={{ skewX: isTalking ? [-3,3,-3] : [-2,2,-2] }}
        transition={{ duration: isTalking ? 0.5 : 2, repeat:Infinity }}/>

      {/* Antenna */}
      <line x1="67" y1="13" x2="67" y2="2" stroke={BK} strokeWidth="2.5" strokeLinecap="round"/>
      <motion.circle cx="67" cy="1.5" r="5" fill="#FCD34D" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [5,7.5,5] : [5,6.5,5] }}
        transition={{ duration: isTalking ? 0.5 : 1, repeat:Infinity }}/>

      {/* Head */}
      <path d="M41 14 L55 9 L96 9 L82 14 Z" fill={YT}/>
      <path d="M82 14 L96 9 L96 48 L82 48 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="41" y="14" width="41" height="34" rx="8" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
      <rect x="45" y="19" width="32" height="22" rx="6" fill={`url(#panel-${id})`}/>

      {/* Big eyes */}
      <motion.circle cx="55" cy="29" r="6.5" fill="#FCD34D" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [6.5,9,6.5] : [6.5,8,6.5] }}
        transition={{ duration: isTalking ? 0.55 : 1.2, repeat:Infinity }}/>
      <motion.circle cx="71" cy="29" r="6.5" fill="#FCD34D" filter={`url(#ey-${id})`}
        animate={{ r: isTalking ? [6.5,9,6.5] : [6.5,8,6.5] }}
        transition={{ duration: isTalking ? 0.55 : 1.2, repeat:Infinity, delay:0.1 }}/>
      <circle cx="56.5" cy="27.5" r="2.2" fill="white"/>
      <circle cx="72.5" cy="27.5" r="2.2" fill="white"/>
      {/* Eye blink overlay */}
      <motion.rect x="45" y="19" width="32" height="22" rx="6" fill={`url(#panel-${id})`} pointerEvents="none"
        animate={{ opacity: [0,0,0,0,0,0,1,0,0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 0.8 }}/>

      {/* Mouth — grin when not talking, animated when talking */}
      {!isTalking
        ? <path d="M49 38 Q61 46 73 38" stroke="#FCD34D" strokeWidth="2" fill="none" strokeLinecap="round"/>
        : <Mouth cx={61} cy={39} w={20} isTalking={true} color="#FCD34D" />
      }

      {/* Neck */}
      <rect x="55" y="47" width="15" height="7" rx="3" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Body */}
      <path d="M25 58 L38 53 L98 53 L85 58 Z" fill={YT} opacity="0.8"/>
      <path d="M85 58 L98 53 L98 112 L85 112 Z" fill={YS} stroke={BK} strokeWidth="1"/>
      <rect x="25" y="58" width="60" height="54" rx="10" fill={`url(#fg-${id})`} stroke={BK} strokeWidth="2"/>
      <rect x="33" y="64" width="44" height="29" rx="6" fill={`url(#panel-${id})`}/>
      <text x="42" y="79" fontSize="17">⭐</text>
      <motion.text x="37" y="88" fontSize="6.5" fill="#FCD34D" fontFamily="monospace" fontWeight="800"
        animate={{ opacity: isTalking ? [1,0.5,1] : 1 }}
        transition={{ duration:0.5, repeat:Infinity }}>97.3%</motion.text>

      {/* Hip */}
      <rect x="28" y="95" width="54" height="14" rx="5" fill={DM}/>

      {/* Left arm — single segment hanging down, hand on hip — drawn BEFORE shoulder */}
      <motion.g
        animate={{ rotate: isTalking ? [-8, 6, -4, 8, -8] : [-4, 4, -4] }}
        style={{ transformOrigin:"25px 66px" }}
        transition={{ duration: isTalking ? 0.65 : 2.5, repeat:Infinity, ease:"easeInOut" }}>
        <rect x="14" y="64" width="13" height="33" rx="5.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <circle cx="20" cy="99" r="7.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
      </motion.g>

      {/* Right arm — raised fist (drawn BEFORE shoulder) */}
      <motion.g
        animate={{ rotate: isTalking ? [-5, 5, -3, 6, -5] : [-2, 2, -2] }}
        style={{ transformOrigin:"85px 66px" }}
        transition={{ duration: isTalking ? 0.6 : 2.8, repeat:Infinity, ease:"easeInOut" }}>
        <rect x="85" y="22" width="11" height="46" rx="5.5" fill={Y} stroke={BK} strokeWidth="1.5"/>
        <rect x="82" y="9" width="18" height="17" rx="5" fill={Y} stroke={BK} strokeWidth="2"/>
        <line x1="84" y1="14" x2="99" y2="14" stroke={BK} strokeWidth="1.2" opacity="0.4"/>
        <line x1="84" y1="18" x2="99" y2="18" stroke={BK} strokeWidth="1.2" opacity="0.4"/>
      </motion.g>
      {/* Victory sparkles bursting from fist */}
      {[[-11,-10],[11,-13],[-5,-16],[12,-5],[-14,-3],[8,-18]].map(([dx,dy],i) => (
        <motion.circle key={i} cx={91+dx} cy={18+dy} r={isTalking ? 3.5 : 2.5} fill="#FCD34D"
          animate={{ opacity:[0,1,0], scale:[0, isTalking ? 2 : 1.6, 0] }}
          transition={{ duration: isTalking ? 0.42 : 0.8, repeat:Infinity, delay:i*0.14 }}/>
      ))}
      {/* Orbiting ring around fist when talking */}
      {isTalking && (
        <motion.circle cx="91" cy="18" r="18" fill="none" stroke="#FCD34D" strokeWidth="1.5" strokeDasharray="4 6"
          animate={{ rotate: [0, 360] }}
          style={{ transformOrigin:"91px 18px" }}
          transition={{ duration: 1.5, repeat:Infinity, ease:"linear" }}/>
      )}

      {/* Shoulder joints — drawn AFTER both arms */}
      <circle cx="25" cy="66" r="8" fill={DM} stroke={BK} strokeWidth="1.5"/>
      <circle cx="85" cy="66" r="8" fill={DM} stroke={BK} strokeWidth="1.5"/>

      {/* Legs */}
      <path d="M62 112 L70 109 L70 138 L62 138 Z" fill={YS}/>
      <rect x="30" y="112" width="32" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="25" y="136" width="38" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
      <path d="M76 112 L84 109 L84 138 L76 138 Z" fill={YS}/>
      <rect x="58" y="112" width="32" height="28" rx="7" fill={Y} stroke={BK} strokeWidth="1.5"/>
      <rect x="56" y="136" width="38" height="13" rx="6" fill={D} stroke={BK} strokeWidth="1.5"/>
    </svg>
  );
}

const ROBOT_COMPONENTS: Record<number, (props: { isTalking?: boolean }) => React.ReactElement> = {
  1: RobotP1, 2: RobotP2, 3: RobotP3, 4: RobotP4, 5: RobotP5,
};

// ─── Talking particles ─────────────────────────────────────────────────────────
function TalkingParticles({ accent }: { accent: typeof PHASE_ACCENTS[1] }) {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <motion.div
          key={i}
          style={{
            position:     "absolute",
            width:        3 + (i % 3) * 2,
            height:       3 + (i % 3) * 2,
            borderRadius: "50%",
            background:   accent.border,
            boxShadow:    `0 0 6px ${accent.border}`,
            left:         `${22 + i * 9}%`,
            bottom:       "56%",
            zIndex:       105,
          }}
          animate={{
            y:       [-4, -55 - i * 10],
            opacity: [0, 0.95, 0],
            x:       [0, (i % 2 === 0 ? 10 : -10) * (1 + i * 0.15)],
            scale:   [0.4, 1.3, 0.1],
          }}
          transition={{
            duration: 1.5,
            delay:    i * 0.2,
            repeat:   Infinity,
            ease:     "easeOut",
          }}
        />
      ))}
    </>
  );
}

// ─── Audio equalizer bars in speech bubble ─────────────────────────────────────
function EqBars({ color, active }: { color: string; active: boolean }) {
  const heights = [6, 10, 7, 12, 8, 11, 6];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 13, marginLeft: 6 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          style={{ width: 2.5, background: color, borderRadius: 1.5, opacity: 0.8 }}
          animate={active ? { height: [h * 0.3, h, h * 0.5, h * 0.8, h * 0.3] } : { height: 2.5 }}
          transition={{ duration: 0.45 + i * 0.06, repeat: Infinity, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
}

// ─── Main SentraMascot ─────────────────────────────────────────────────────────
export function SentraMascot({ phase, active, instant }: SentraMascotProps) {
  const accent     = PHASE_ACCENTS[phase];
  const text       = NARRATIVES[phase];
  const { shown, done } = useTyping(text, active, instant ?? false);
  const isTalking  = active && !done;
  const RobotSvg   = ROBOT_COMPONENTS[phase];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={`mascot-${phase}`}
          initial={{ y: 320, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 220, opacity: 0 }}
          transition={{ type: "spring", stiffness: 170, damping: 20, delay: 0.2 }}
          style={{
            position:      "fixed",
            bottom:        0,
            right:         16,
            zIndex:        100,
            display:       "flex",
            flexDirection: "column",
            alignItems:    "flex-end",
            gap:           0,
            pointerEvents: "none",
          }}
        >
          {/* Speech bubble */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
            style={{
              position:            "relative",
              width:               "clamp(265px, 35vw, 390px)",
              marginBottom:        8,
              background:          "rgba(6,6,12,0.93)",
              backdropFilter:      "blur(22px)",
              WebkitBackdropFilter:"blur(22px)",
              border:              `1.5px solid ${accent.border}`,
              borderRadius:        16,
              padding:             "14px 18px",
              boxShadow:           `0 0 40px rgba(${accent.rgb},0.28), 0 8px 36px rgba(0,0,0,0.55), inset 0 0 22px rgba(${accent.rgb},0.06)`,
              pointerEvents:       "auto",
            }}
          >
            {/* Header row */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <motion.div
                animate={{ boxShadow:[`0 0 5px rgba(${accent.rgb},0.6)`,`0 0 16px rgba(${accent.rgb},1)`,`0 0 5px rgba(${accent.rgb},0.6)`] }}
                transition={{ duration: isTalking ? 0.45 : 1.4, repeat:Infinity }}
                style={{ width:8, height:8, borderRadius:"50%", background:accent.border, flexShrink:0 }}
              />
              <span style={{ fontSize:9, fontWeight:800, fontFamily:"monospace", letterSpacing:"2.5px", color:accent.border, textTransform:"uppercase" }}>
                SENTRA
              </span>
              <span style={{ fontSize:9, color:accent.border, opacity:0.55, fontFamily:"monospace" }}>
                {"// "}{accent.label}
              </span>
              <span style={{ marginLeft:"auto", fontSize:9, color:done?"#22C55E":accent.border, fontFamily:"monospace", opacity:0.7 }}>
                {done ? "✓ done" : "..."}
              </span>
              {isTalking && <EqBars color={accent.border} active={isTalking} />}
            </div>

            {/* Divider */}
            <div style={{ height:1, background:`linear-gradient(90deg, ${accent.border}60, transparent)`, marginBottom:10 }}/>

            {/* Typed text */}
            <div style={{ fontSize:12, lineHeight:1.65, color:"rgba(255,255,255,0.88)", fontFamily:"system-ui, sans-serif", minHeight:54 }}>
              {shown}
              {!done && (
                <motion.span
                  animate={{ opacity:[1,0] }}
                  transition={{ duration:0.45, repeat:Infinity }}
                  style={{ display:"inline-block", width:2, height:12, background:accent.border, marginLeft:2, verticalAlign:"middle" }}
                />
              )}
            </div>

            {/* Bubble tail pointing toward robot (bottom-right) */}
            <div style={{ position:"absolute", bottom:-10, right:36, width:0, height:0,
              borderLeft:"9px solid transparent", borderRight:"9px solid transparent",
              borderTop:`10px solid ${accent.border}` }}/>
            <div style={{ position:"absolute", bottom:-8, right:37, width:0, height:0,
              borderLeft:"8px solid transparent", borderRight:"8px solid transparent",
              borderTop:"9px solid rgba(6,6,12,0.93)" }}/>
          </motion.div>

          {/* Talking particles above robot */}
          <div style={{ position:"relative", width:180, height:0 }}>
            {isTalking && <TalkingParticles accent={accent} />}
          </div>

          {/* 3D Robot */}
          <motion.div
            animate={isTalking ? {
              y:      [0, -16, -5, -14, 0],
              rotate: [0, -5, 4, -3, 0],
              scaleX: [1, 1.04, 0.96, 1.03, 1],
            } : {
              y:      [0, -9, 0],
              rotate: [0, 1.5, 0],
              scaleX: 1,
            }}
            transition={isTalking
              ? { duration: 0.92, repeat: Infinity, ease: "easeInOut" }
              : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              width:        175,
              height:       205,
              cursor:       "default",
              filter:       isTalking
                ? `drop-shadow(0 0 22px rgba(${accent.rgb},0.9)) drop-shadow(0 0 50px rgba(${accent.rgb},0.45)) drop-shadow(0 4px 12px rgba(0,0,0,0.7))`
                : `drop-shadow(0 12px 30px rgba(${accent.rgb},0.35)) drop-shadow(0 4px 12px rgba(0,0,0,0.6))`,
              transform:    "perspective(700px) rotateY(-12deg) rotateX(-4deg)",
              pointerEvents:"auto",
              transition:   "filter 0.3s ease",
            }}
          >
            <RobotSvg isTalking={isTalking} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
