"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { submitFeedback } from "@/lib/user-api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, Mail, MessageSquare } from "lucide-react";

export default function FeedbackPage() {
  const { data: session } = useSession();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }

    try {
      setIsLoading(true);
      await submitFeedback(session?.accessToken as string, { subject, description });
      toast.success("Feedback submitted successfully!");
      setSubject("");
      setDescription("");
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e.message || "Failed to submit feedback.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-start pt-12 pb-10 px-4 sm:px-6">      
      <div className="w-full max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}  
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.4 }}
          className="text-center mb-12 flex flex-col items-center"
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-accent-cyan/20 blur-xl rounded-full transform scale-125"></div>
            <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-b from-accent-cyan/20 to-transparent border border-accent-cyan/30 rounded-2xl text-accent-cyan backdrop-blur-sm shadow-[0_0_15px_rgba(var(--accent-cyan-rgb),0.2)]">
              <MessageSquare className="w-7 h-7 stroke-[2]" />
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-foreground">
            We&apos;d Love Your Input
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Let us know about any issues or how we can improve the platform.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="bg-card w-full rounded-3xl border border-border/60 shadow-xl overflow-hidden ring-1 ring-white/5"
        >
          <div className="p-8 sm:p-10 space-y-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-semibold text-foreground/90">
                  Subject <span className="text-muted-foreground text-xs font-normal ml-1">(Optional)</span>
                </label>
                <input
                  id="subject"
                  type="text"
                  placeholder="What is this regarding?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan/50 transition-all shadow-sm placeholder:text-muted-foreground/60"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-semibold text-foreground/90 flex justify-between">
                  <span>Description <span className="text-destructive ml-0.5">*</span></span>
                </label>
                <textarea
                  id="description"
                  placeholder="Please provide details about your suggestion or any issues you encountered..."
                  className="w-full min-h-[300px] bg-background border border-border/80 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan/50 transition-all shadow-sm resize-y placeholder:text-muted-foreground/60 leading-relaxed"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Send Feedback"
                  )}
                </button>
              </div>
            </form>

            <div className="pt-6 border-t border-border/40 text-center">
              <p className="text-sm text-muted-foreground flex items-center justify-center flex-wrap gap-1.5">
                Prefer email? Contact us directly at
                <a 
                  href="mailto:sentra.quest@gmail.com" 
                  className="inline-flex items-center gap-1.5 text-accent-cyan hover:text-accent-cyan/80 font-medium transition-colors hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  sentra.quest-
                </a>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
