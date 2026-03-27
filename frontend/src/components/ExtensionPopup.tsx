"use client";

import { ShieldAlert, Info, AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export function ExtensionPopup() {
  return (
    <div className="w-[380px] h-[520px] bg-background border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col relative text-foreground font-sans">
      {/* Header */}
      <div className="h-14 border-b border-border/50 flex items-center px-4 justify-between bg-card text-foreground z-10 shadow-sm relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-red/20 text-accent-red flex items-center justify-center">
            <ShieldAlert size={18} />
          </div>
          <span className="font-bold tracking-tight">Sentra Ext.</span>
        </div>
        <button type="button" aria-label="Show extension information" className="text-muted-foreground hover:text-foreground">
          <Info size={16} />
        </button>
      </div>

      {/* Hero Issue Section */}
      <div className="relative p-6 pt-8 flex-col flex items-center text-center bg-gradient-to-b from-accent-red/10 to-transparent">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="w-16 h-16 rounded-full bg-accent-red flex items-center justify-center text-white mb-4 shadow-[0_0_25px_hsl(var(--accent-red)/0.5)]"
        >
          <AlertTriangle size={32} />
        </motion.div>
        <h2 className="text-xl font-bold mb-1">PHISHING DETECTED</h2>
        <p className="text-sm text-muted-foreground">High risk markers found in this email.</p>
        
        {/* Confidence Bar */}
        <div className="w-full mt-6 space-y-2">
          <div className="flex justify-between text-xs font-bold font-mono">
            <span>Threat Level</span>
            <span className="text-accent-red">98%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "98%" }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="h-full bg-accent-red relative"
            >
              <div className="absolute top-0 right-0 w-8 h-full bg-white/30 blur-sm transform skew-x-12 animate-pulse" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Analysis Details */}
      <div className="flex-1 px-6 space-y-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Analysis Results</div>
        <ul className="space-y-3">
          {[
            "Malicious Link Patterns Found",
            "Unusual Urgency Score: High",
            "Sender Behavioral Anomalies"
          ].map((item, i) => (
            <motion.li 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="flex items-start gap-2 text-sm bg-accent-red/5 p-2 rounded border border-accent-red/10"
            >
              <ShieldAlert size={16} className="text-accent-red flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="p-4 flex flex-col gap-2 mt-auto">
        <button type="button" aria-label="Report phishing and delete email" className="w-full btn-neon bg-accent-red text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-accent-red/90 border border-transparent shadow-[0_4px_14px_hsl(var(--accent-red)/0.3)]">
          Report Phish & Delete
        </button>
        <div className="flex gap-2">
          <button type="button" aria-label="Delete email" className="flex-1 bg-muted/50 hover:bg-muted text-muted-foreground font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs transition-colors border border-border/50">
            <Trash2 size={14} />
            Delete
          </button>
          <button type="button" aria-label="Mark email as safe" className="flex-1 bg-muted/50 hover:bg-muted text-muted-foreground font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs transition-colors border border-border/50">
            <ShieldCheck size={14} />
            Mark Safe
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="py-2 text-center text-[10px] text-muted-foreground font-semibold tracking-widest uppercase bg-card/50 border-t border-border/50">
        POWERED BY Sentra AI
      </div>
    </div>
  );
}
