"use client";

import React from "react";
import { motion } from "framer-motion";
import { TeamCard, TeamMember } from "@/components/about/TeamCard";
import { ContactForm } from "@/components/about/ContactForm";

const teamMembers: TeamMember[] = [
  {
    name: "Thien Quy Pham",
    role: "Founder",
    affiliation: "Computer Science Student at University of Toledo",
    bio: "Visionary leader with a passion for cybersecurity and AI. Combining deep technical expertise with strategic product direction, focusing on creating seamless and secure data environments.",
    contributions: [
      "Led the overall architecture and product vision for Sentra.",
      "Developed the core Threat Intelligence engine using Advanced LLMs.",
      "Engineered the foundational data pipeline for model training."
    ],
    skills: ["Python", "PyTorch", "Next.js", "System Architecture", "Leadership"],
    links: {
      portfolio: "https://thienquypham.vercel.app/",
      linkedin: "https://www.linkedin.com/in/thienquypham/",
      github: "https://github.com/thienquy05"
    }
  },
  {
    name: "Hoang Nhat Duy Le",
    role: "Co-Founder",
    affiliation: "Student at University",
    bio: "Innovative problem solver with a strong background in backend systems and real-time processing architectures.",
    contributions: [
      "Architected the scalable FastAPI backend infrastructure.",
      "Implemented the Redis caching layer to reduce scan latency by 40%.",
      "Designed the AI agentic orchestration logic for browser extensions."
    ],
    skills: ["FastAPI", "Redis", "Docker", "PostgreSQL", "Cloud Config"],
    links: {
      portfolio: "#",
      linkedin: "https://linkedin.com",
      github: "https://github.com"
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
                <div className="p-5 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                  <p className="text-sm md:text-base italic text-cyan-400/90 font-medium m-0">
                    [Scaffold: How did Sentra start? What was the specific phishing attack or security realization that led you down this path? Describe the initial "aha!" moment here.]
                  </p>
                </div>
                <p className="text-sm md:text-base leading-relaxed">
                  [Example: We saw firsthand how easily sophisticated phishing schemes bypassed traditional spam filters. It wasn't just about bad grammar anymore; attackers were cloning legitimate portals. We realized static rules weren't enough—we needed an AI agentic approach to understand the actual intent behind the messages.]
                </p>
              </div>
            </div>

            {/* Integration Process */}
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">Integration Process</h2>
              <div className="w-16 h-1 flex-shrink-0 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.6)]"></div>
              
              <div className="prose prose-invert max-w-none text-foreground/80 space-y-5 mt-6">
                <div className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-sm md:text-base italic text-purple-400/90 font-medium m-0">
                    [Scaffold: How did the product evolve technically? Mention your transition from early prototypes to the current stack and orchestration.]
                  </p>
                </div>
                <p className="text-sm md:text-base leading-relaxed">
                  [Example: Scaling our vision meant bridging a real-time browser extension with a high-performance backend. We integrated WebSockets for instant communication, leveraged Redis for sub-millisecond cache lookups, and built a custom LLM pipeline to analyze threat models on the fly without compromising user privacy.]
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
                  [Scaffold: Give a brief overview of why your solution outshines the competition. Highlight the unique architecture. Below are sample pillars you can edit.]
                </p>
              </div>

              <div className="space-y-5">
                {/* Feature 1 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">[0-Day Threat Detection]</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    [How do your AI models catch what signatures miss? Describe the LLM intent-analysis approach that anticipates novel attacks.]
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-purple-500/20 relative overflow-hidden group transition-all hover:border-purple-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-purple-400 mb-2">[Microsecond Latency]</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    [Mention the FastAPI & Redis architecture that allows you to scan emails in real-time seamlessly without delaying the user's workflow.]
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">[Privacy First Design]</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    [Detail how user data is protected during scans. E.g., No emails are permanently stored, analysis runs entirely in memory, etc.]
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
