"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { MOCK_LIVE_FEED } from "@/lib/mock-data";
import { EmailResult } from "@/types";

export function LiveFeed({ isDemo }: { isDemo?: boolean }) {
  const [feed, setFeed] = useState<EmailResult[]>([]);

  useEffect(() => {
    if (isDemo) {
      setFeed(MOCK_LIVE_FEED);
      const interval = setInterval(() => {
        const newEvent: EmailResult = {
          id: `ev-${Date.now()}`,
          subject: `Automated Scan ${Math.floor(Math.random() * 1000)}`,
          generatorResponse: "N/A",
          detectorResponse:
            Math.random() > 0.7
              ? "Suspicious sender domain detected."
              : "All heuristics neutral.",
          verdict: Math.random() > 0.7 ? "phishing" : "safe",
          confidence: Math.floor(Math.random() * 20) + 80,
          timestamp: new Date().toISOString(),
        };
        setFeed((prev) => [newEvent, ...prev].slice(0, 8));
      }, 4000);
      return () => clearInterval(interval);
    } else {
      // TODO: Implement real-time data fetching via WebSockets or polling
    }
  }, [isDemo]);

  return (
    <div className="glass-panel p-6 rounded-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-cyan"></span>
          </span>
          Live Detection Feed
        </h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock size={12} /> Auto-updating
        </span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-0 w-full h-4 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
        <div className="space-y-3 overflow-y-auto h-full pr-2 pb-4 scrollbar-thin">
          <AnimatePresence initial={false}>
            {feed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0, scale: 0.9 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="p-3.5 rounded-lg bg-background/50 border border-border/50 text-sm flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="font-medium truncate flex-1" title={item.subject}>{item.subject}</div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0 ${
                    item.verdict === "phishing" ? "bg-accent-red/10 text-accent-red" : "bg-accent-green/10 text-accent-green"
                  }`}>
                    {item.verdict === "phishing" ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                    {item.verdict}
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span className="truncate max-w-[200px]">{item.detectorResponse}</span>
                  <span className="font-mono">{item.confidence}% Conf</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="absolute bottom-0 w-full h-10 bg-gradient-to-t from-[hsl(var(--card))] to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
}
