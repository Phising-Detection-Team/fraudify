"use client";

import React from "react";
import { motion } from "framer-motion";
import { TeamCard, TeamMember } from "@/components/about/TeamCard";
import { ContactForm } from "@/components/about/ContactForm";

const teamMembers: TeamMember[] = [
  {
    name: "Thien Quy Pham",
    role: "Founder",
    photo:"/quy.png",
    affiliation: "Computer Science Student at University of Toledo",
    bio: "Cybersecurity and AI engineer securing LLMs and stopping zero-day phishing in real time.",
    contributions: [
      <span><strong className="text-cyan-400 font-bold">Browser Defense:</strong> Built a DOM-level interception system that catches and disables hidden HTML payloads before they can trick the AI.</span>,
      <span><strong className="text-cyan-400 font-bold">AI Safety & Training:</strong> Pen-tested the LLM with prompt-injection attacks and hardened it to eliminate exploitable vulnerabilities.</span>,
      <span><strong className="text-cyan-400 font-bold">Backend Security:</strong> Engineered a secure server infrastructure using FastAPI and JWT authentication to keep user data locked down and safe from tampering.</span>,
      <span><strong className="text-cyan-400 font-bold">Threat Intelligence:</strong> Integrated the VirusTotal API to cross-check suspicious links against 70+ active antivirus scanners in real-time.</span>
    ],
    skills: ["Adversarial Prompt Research", "DOM-Level Prompt Defense", "JWT Auth Architecture", "Database Schema Security", "Penetration Testing"],
    links: {
      portfolio: "https://thienquypham.vercel.app/",
      linkedin: "https://www.linkedin.com/in/thienquypham/",
      github: "https://github.com/thienquy05"
    }
  },
  {
    name: "Hoang Nhat Duy Le",
    role: "Co-Founder",
    photo: "/hoang.png",
    affiliation: "Student at University",
    bio: "Innovative problem solver with a strong background in backend systems and real-time processing architectures.",
    contributions: [
      <span><strong className="text-cyan-400 font-bold">Backend Architecture:</strong> Architected the scalable FastAPI backend infrastructure to handle high-volume real-time requests.</span>,
      <span><strong className="text-cyan-400 font-bold">Caching Strategy:</strong> Implemented the Redis caching layer to reduce scan latency by 40%.</span>,
      <span><strong className="text-cyan-400 font-bold">AI Orchestration:</strong> Designed the AI agentic orchestration logic for browser extensions.</span>
    ],
    skills: ["FastAPI", "Redis", "Docker", "PostgreSQL", "Cloud Config"],
    links: {
      portfolio: "https://hoangnhatduyle.github.io/portfolio/",
      linkedin: "https://www.linkedin.com/in/hoangnhatduyle/",
      github: "https://github.com/hoangnhatduyle"
    }
  },
  {
    name: "Hoang Bao Duy Le",
    affiliation: "Student at University",
    role: "Co-Founder",
    bio: "Dedicated engineer focusing on robust integrations, security protocols, and maintaining flawless user experiences.",
    contributions: [
      "Integrated secure authentication and OAuth pipelines.",
      "Developed the rate-limiting and anti-abuse mechanisms.",
      "Pioneered the browser extension integration with the sentra backend via WebSockets."
    ],
    skills: ["Node.js", "Socket.io", "TypeScript", "Security", "REST APIs"],
    links: {
      portfolio: "#",
      linkedin: "https://linkedin.com",
      github: "https://github.com"
    }
  },
  {
    name: "Thanh Dang Huynh",
    affiliation: "Student at University",
    role: "Fullstack Developer",
    bio: "Creative developer who bridges the gap between powerful backend logic and beautiful, accessible frontend interfaces.",
    contributions: [
      "Built the modern Next.js dashboard and analytic views.",
      "Implemented the Sentra design system and Framer Motion animations.",
      "Constructed the secure Chrome Extension UI and popup logic."
    ],
    skills: ["React", "Tailwind CSS", "Framer Motion", "Next.js", "UX/UI"],
    links: {
      portfolio: "#",
      linkedin: "https://linkedin.com",
      github: "https://github.com"
    }
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen py-20 px-4 md:px-8 relative overflow-hidden bg-background">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-30 select-none"
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="max-w-6xl mx-auto space-y-24 relative z-10">
        
        {/* Mission / Story */}
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-6"
        >
          <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight pb-2">
            Meet the Minds Behind <br />
            <span className="neon-text bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              Sentra
            </span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/80 leading-relaxed font-medium">
            We are a group of dedicated developers and security enthusiasts focused on combating modern-day phishing attacks. Our mission is to build robust, AI-powered tools that bring peace of mind to your digital environment.
          </p>
        </motion.section>

        {/* Story & Team Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start pt-8">
          
          {/* Left Column: Origin Story */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-12"
          >
            {/* Origin Story */}
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">Our Story</h2>
              <div className="w-16 h-1 flex-shrink-0 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]"></div>
              
              <div className="prose prose-invert max-w-none text-foreground/80 space-y-5 mt-6 pb-2">
                <p className="text-sm md:text-base leading-relaxed">
                  The origins of Sentra are rooted in the rapidly evolving landscape of social engineering. 
                  As malicious actors continuously develop more sophisticated tools to harvest personal data without triggering alarm, 
                  traditional security measures often fall short. The catalyst for Sentra was a personal experience: losing an account 
                  to a phishing site that was virtually indistinguishable from the real one. 
                  The deception was seamless, and the compromise happened in an instant.
                </p>
                <p className="text-sm md:text-base leading-relaxed">
                  That moment highlighted a critical vulnerability, if a site looks perfectly legitimate, even cautious users will surrender their information. 
                  This realization sparked a deep focus on cybersecurity and a drive to utilize artificial intelligence to proactively fight advanced phishing campaigns. 
                  After joining forces with a partner who shared this exact background and passion, we built Sentra: an AI-driven phishing detection platform designed to 
                  protect users before they even realize they are under attack.
                </p>
              </div>
            </div>

            {/* Architecture Process */}
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">The Architecture</h2>
              <div className="w-16 h-1 flex-shrink-0 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.6)]"></div>
              
              <div className="prose prose-invert max-w-none text-foreground/80 space-y-5 mt-6">
                <p className="text-sm md:text-base leading-relaxed">
                  Building something trustworthy enough to protect people required us to make every technical decision deliberately. We recognized early on that a simple approach would not withstand today’s digital threat landscape, so we engineered an architecture focused entirely on speed, privacy, and reliability.
                </p>
                <p className="text-sm md:text-base leading-relaxed">
                  To protect you in real time - not after the damage is done - we bridged a lightweight browser extension with a high-performance backend. We built on WebSockets for instant communication and Redis for threat lookups faster than a single frame of video. At the core of our defense mechanism is a custom LLM pipeline, analyzing emerging threats on the fly without ever storing your personal data.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Team Grid */}
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:text-right text-left"
            >
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">The Core Team</h2>
              <div className="w-16 h-1 bg-cyan-500 mt-4 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)] lg:ml-auto ml-0"></div>
            </motion.div>

            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.15 }
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              {teamMembers.map((member, idx) => (
                <TeamCard key={idx} member={member} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* Why Sentra & Contact Section */}
        <section id="contact" className="pt-16 pb-10 border-t border-border/20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Column: Why Sentra */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  Why Choose <span className="neon-text bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">Sentra?</span>
                </h2>
                <p className="text-foreground/70 text-base md:text-lg pt-2 leading-relaxed">
                  We built Sentra to provide enterprise-grade protection that simply works out of the box. It installs in under 60 seconds, requires zero configuration from the user, and silently secures millions of digital interactions with 99.9% reliability. Real security shouldn't force you to change how you work - it should protect you while you do.
                </p>
              </div>

              <div className="space-y-5">
                {/* Feature 1 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">Intelligent Threat Detection</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    Trained on a robust dataset of over 44,000 diverse emails, our AI engine leverages a deep contextual understanding to identify malicious intent. 
                    Designed to neutralize adversarial tricks and prompt injection attempts, Sentra consistently achieves up to 90% detection accuracy against zero-day 
                    phishing attacks within 20 seconds.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-purple-500/20 relative overflow-hidden group transition-all hover:border-purple-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-purple-400 mb-2">Sub-Millisecond Latency</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    Security should never interrupt your day. We've optimized our technology to scan for known threats in extreme sub-millisecond ranges 
                    (averaging under 800 microseconds - faster than the blink of an eye). 
                    This ensures seamless, real-time protection directly in your browser without causing any lag.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">Zero-Trust Data Protection</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    Security is built into the core of our platform, not added as an afterthought. We enforce a zero-trust model where sensitive credentials 
                    are never exposed or logged in plain text. Through rigorous cryptographic hashing and salting, we guarantee that 100% of your data remains safely encrypted, 
                    inaccessible, and mathematically protected against any unauthorized breach.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Contact Form */}
            <div className="w-full">
              <ContactForm />
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
