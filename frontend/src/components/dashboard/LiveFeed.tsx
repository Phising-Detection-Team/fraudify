"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { io } from "socket.io-client";
import { EmailResult } from "@/types";

interface HeartbeatEvent {
  instance_id: string;
  browser: string;
  last_seen: string;
}

interface HeartbeatFeedItem {
  id: string;
  browser: string;
  lastSeen: string;
  type: "heartbeat";
}

export function LiveFeed() {
  const [feed] = useState<EmailResult[]>([]);
  const [events, setEvents] = useState<HeartbeatFeedItem[]>([]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000");

    socket.on("extension_heartbeat", (data: HeartbeatEvent) => {
      setEvents((prev) =>
        [
          {
            id: data.instance_id,
            browser: data.browser,
            lastSeen: data.last_seen,
            type: "heartbeat" as const,
          },
          ...prev,
        ].slice(0, 20)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Combine heartbeat events with the static feed
  const displayFeed: EmailResult[] = feed.length > 0 ? feed : [];

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

      {/* Heartbeat events */}
      {events.length > 0 && (
        <div className="mb-4 space-y-2">
          {events.slice(0, 5).map((ev) => (
            <div
              key={`hb-${ev.id}-${ev.lastSeen}`}
              className="px-3 py-2 rounded-lg bg-accent-cyan/5 border border-accent-cyan/20 text-xs flex items-center justify-between"
            >
              <span className="font-medium text-accent-cyan">{ev.browser}</span>
              <span className="text-muted-foreground font-mono">
                {new Date(ev.lastSeen).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-0 w-full h-4 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
        <div className="space-y-3 overflow-y-auto h-full pr-2 pb-4 scrollbar-thin">
          <AnimatePresence initial={false}>
            {displayFeed.map((item) => (
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
