"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { sendContactEmail } from "@/app/actions/contact";
import { Mail, User, MessageSquare, Send } from "lucide-react";

export const ContactForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    setIsSubmitting(true);
    const formData = new FormData(formRef.current);

    toast.promise(
      // We wrap the server action into a promise so we can show loading toast
      new Promise(async (resolve, reject) => {
        const result = await sendContactEmail(null, formData);
        if (result && !result.success) {
          reject(new Error(result.error));
        } else {
          resolve(result?.message);
        }
      }),
      {
        loading: "Sending message...",
        success: () => {
          formRef.current?.reset();
          return "Message sent successfully!";
        },
        error: (err: unknown) => {
          const error = err as Error;
          return `Error: ${error.message}`;
        },
      }
    );

    setIsSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="glass-panel p-6 md:p-8 rounded-xl max-w-xl mx-auto w-full"
    >
      <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-center neon-text">Get in Touch</h2>
      <p className="text-sm md:text-base text-center text-foreground/70 mb-6 md:mb-8 max-w-md mx-auto leading-relaxed">
        Have questions or want to collaborate? Send us a message and we&apos;ll get back to you shortly.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <div className="space-y-1.5 md:space-y-2 relative group">
            <label htmlFor="name" className="text-xs md:text-sm font-bold tracking-wide text-muted-foreground w-full group-focus-within:text-cyan-500 transition-colors">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-cyan-500 transition-colors" size={16} />
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full text-sm md:text-base bg-background/50 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 md:py-3.5 focus:outline-none focus:ring-0 focus:border-cyan-500 hover:border-cyan-500/50 focus:bg-background focus:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300 text-foreground shadow-sm"
                placeholder="Your Name"
              />
            </div>
          </div>
          <div className="space-y-1.5 md:space-y-2 relative group">
            <label htmlFor="email" className="text-xs md:text-sm font-bold tracking-wide text-muted-foreground w-full group-focus-within:text-cyan-500 transition-colors">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-cyan-500 transition-colors" size={16} />
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full text-sm md:text-base bg-background/50 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 md:py-3.5 focus:outline-none focus:ring-0 focus:border-cyan-500 hover:border-cyan-500/50 focus:bg-background focus:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300 text-foreground shadow-sm"
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 md:space-y-2 relative group">
          <label htmlFor="subject" className="text-xs md:text-sm font-bold tracking-wide text-muted-foreground w-full group-focus-within:text-cyan-500 transition-colors">
            Subject
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-cyan-500 transition-colors" size={16} />
            <input
              type="text"
              id="subject"
              name="subject"
              required
              className="w-full text-sm md:text-base bg-background/50 border border-border/50 rounded-xl pl-10 pr-4 py-2.5 md:py-3.5 focus:outline-none focus:ring-0 focus:border-cyan-500 hover:border-cyan-500/50 focus:bg-background focus:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300 text-foreground shadow-sm"
              placeholder="How can we help you?"
            />
          </div>
        </div>

        <div className="space-y-1.5 md:space-y-2 relative group">
          <label htmlFor="message" className="text-xs md:text-sm font-bold tracking-wide text-muted-foreground w-full group-focus-within:text-cyan-500 transition-colors">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            className="w-full text-sm md:text-base bg-background/50 border border-border/50 rounded-xl px-4 py-2.5 md:py-3.5 focus:outline-none focus:ring-0 focus:border-cyan-500 hover:border-cyan-500/50 focus:bg-background focus:shadow-[0_0_15px_rgba(0,255,255,0.1)] transition-all duration-300 text-foreground resize-none shadow-sm"
            placeholder="Your message here..."
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-neon text-sm md:text-base md:font-bold font-semibold tracking-widest uppercase flex items-center justify-center py-3.5 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] active:scale-[0.98] transition-all duration-300 group"
          >
            {isSubmitting ? "Sending..." : (
               <>
                 Send Message 
                 <Send className="ml-2 md:ml-3 w-4 h-4 md:w-[18px] md:h-[18px] opacity-80 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
               </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};
