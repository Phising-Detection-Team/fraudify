"use client";

import { config } from "@/lib/config";
import { MOCK_ROUNDS } from "@/lib/mock-data";
import { ShieldAlert, ShieldCheck, ArrowLeft, Bot, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RoundDetailView() {
  const pathname = usePathname();
  const params = useParams();
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const demoFlag = localStorage.getItem(config.STORAGE_KEYS.IS_DEMO) === "true";
    setIsDemo(demoFlag);
    setLoading(false);
  }, []);

  const isAdmin = pathname.includes('/dashboard/admin');
  const baseHref = isAdmin ? "/dashboard/admin" : "/dashboard/user";
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Real DB state fetch logic here later
  const round = isDemo 
    ? MOCK_ROUNDS.find(r => r.id === id) 
    : null; // Return null intentionally if not in demo mode since real DB is empty

  if (loading) return null;

  if (!round) {
    if (!isDemo) {
       return (
         <div className="space-y-6">
           <Link href={baseHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-cyan transition-colors">
              <ArrowLeft size={16} /> Back to Dashboard
           </Link>
           <div className="p-8 text-center text-muted-foreground pt-20">Round details are not available yet for newly signed up accounts.</div>
         </div>
       );
    }
    return <div className="p-8 text-center text-muted-foreground pt-20">Round not found</div>;
  }

  return (
    <div className="space-y-6">
      <Link href={baseHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent-cyan transition-colors">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      
      <div className="glass-panel p-6 rounded-xl flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Round {round.id.toUpperCase()} details</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <span>{new Date(round.date).toLocaleString()}</span> • 
            <span className={round.detectionRate > 80 ? "text-accent-red font-medium" : ""}>
              {round.detectionRate}% Detection
            </span>
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Generator</div>
            <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded border border-border/50 text-sm">
              <Bot size={16} className="text-accent-purple" />
              gpt-4o
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Detector</div>
            <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded border border-border/50 text-sm">
              <Activity size={16} className="text-accent-cyan" />
              claude-sonnet-4
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium w-16">#</th>
                <th className="px-6 py-4 font-medium w-1/3">Subject</th>
                <th className="px-6 py-4 font-medium flex-1">Generator & Detector Responses</th>
                <th className="px-6 py-4 font-medium w-32">Verdict</th>
                <th className="px-6 py-4 font-medium w-24 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {round.emails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No emails processed in this round.
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {round.emails.map((email, idx) => (
                    <motion.tr 
                      key={email.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`group transition-colors ${
                        email.verdict === 'phishing' 
                          ? 'bg-accent-red/5 hover:bg-accent-red/10' 
                          : 'bg-accent-green/5 hover:bg-accent-green/10'
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-muted-foreground">{idx + 1}</td>
                      <td className="px-6 py-4 font-medium">{email.subject}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="text-xs">
                            <span className="font-semibold text-accent-purple uppercase tracking-wider mr-2 text-[10px]">Gen</span>
                            <span className="text-muted-foreground">{email.generatorResponse}</span>
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold text-accent-cyan uppercase tracking-wider mr-2 text-[10px]">Det</span>
                            <span className="text-foreground">{email.detectorResponse}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          email.verdict === 'phishing' ? 'bg-accent-red/20 text-accent-red border border-accent-red/30' : 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                        }`}>
                          {email.verdict === 'phishing' ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                          {email.verdict}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium">
                        {email.confidence}%
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
