"use client";

import React from "react";
import { motion } from "framer-motion";
import { TeamCard, TeamMember } from "@/components/about/TeamCard";
import { ContactForm } from "@/components/about/ContactForm";
import { useLanguage } from "@/components/LanguageProvider";

export default function AboutPage() {
  const { tr } = useLanguage();
  const teamMembers: TeamMember[] = [
    {
      name: tr("about.member1Name"),
      role: tr("about.member1Role"),
      photo:"/quy.png",
      affiliation: tr("about.affiliationUtoledo"),
      bio: tr("about.member1Bio"),
      contributions: [
        <span><strong className="text-cyan-400 font-bold">{tr("about.browserDefense")}:</strong> {tr("about.member1Contribution1")}</span>,
        <span><strong className="text-cyan-400 font-bold">{tr("about.aiSafetyTraining")}:</strong> {tr("about.member1Contribution2")}</span>,
        <span><strong className="text-cyan-400 font-bold">{tr("about.backendSecurity")}:</strong> {tr("about.member1Contribution3")}</span>,
        <span><strong className="text-cyan-400 font-bold">{tr("about.threatIntelligence")}:</strong> {tr("about.member1Contribution4")}</span>
      ],
      skills: [
        tr("about.member1Skill1"),
        tr("about.member1Skill2"),
        tr("about.member1Skill3"),
        tr("about.member1Skill4"),
        tr("about.member1Skill5"),
      ],
      links: {
        portfolio: "https://thienquypham.vercel.app/",
        linkedin: "https://www.linkedin.com/in/thienquypham/",
        github: "https://github.com/thienquy05"
      }
    },
    {
      name: tr("about.member2Name"),
      role: tr("about.member2Role"),
      photo: "/hoang.png",
      affiliation: tr("about.affiliationStudent"),
      bio: tr("about.member2Bio"),
      contributions: [
        <span><strong className="text-cyan-400 font-bold">{tr("about.backendArchitecture")}:</strong> {tr("about.member2Contribution1")}</span>,
        <span><strong className="text-cyan-400 font-bold">{tr("about.cachingStrategy")}:</strong> {tr("about.member2Contribution2")}</span>,
        <span><strong className="text-cyan-400 font-bold">{tr("about.aiOrchestration")}:</strong> {tr("about.member2Contribution3")}</span>
      ],
      skills: [
        tr("about.member2Skill1"),
        tr("about.member2Skill2"),
        tr("about.member2Skill3"),
        tr("about.member2Skill4"),
        tr("about.member2Skill5"),
      ],
      links: {
        portfolio: "https://hoangnhatduyle.github.io/portfolio/",
        linkedin: "https://www.linkedin.com/in/hoangnhatduyle/",
        github: "https://github.com/hoangnhatduyle"
      }
    },
    {
      name: tr("about.member3Name"),
      affiliation: tr("about.affiliationStudent"),
      role: tr("about.member3Role"),
      bio: tr("about.member3Bio"),
      contributions: [
        tr("about.member3Contribution1"),
        tr("about.member3Contribution2"),
        tr("about.member3Contribution3")
      ],
      skills: [
        tr("about.member3Skill1"),
        tr("about.member3Skill2"),
        tr("about.member3Skill3"),
        tr("about.member3Skill4"),
        tr("about.member3Skill5"),
      ],
      links: {
        portfolio: "#",
        linkedin: "https://linkedin.com",
        github: "https://github.com"
      }
    },
    {
      name: tr("about.member4Name"),
      affiliation: tr("about.affiliationStudent"),
      role: tr("about.member4Role"),
      bio: tr("about.member4Bio"),
      contributions: [
        tr("about.member4Contribution1"),
        tr("about.member4Contribution2"),
        tr("about.member4Contribution3")
      ],
      skills: [
        tr("about.member4Skill1"),
        tr("about.member4Skill2"),
        tr("about.member4Skill3"),
        tr("about.member4Skill4"),
        tr("about.member4Skill5"),
      ],
      links: {
        portfolio: "#",
        linkedin: "https://linkedin.com",
        github: "https://github.com"
      }
    }
  ];

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
            {tr("about.heroTitle1")} <br />
            <span className="neon-text bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              Sentra
            </span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/80 leading-relaxed font-medium">
            {tr("about.heroSubtitle")}
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
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">{tr("about.ourStory")}</h2>
              <div className="w-16 h-1 flex-shrink-0 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.6)]"></div>
              
              <div className="prose prose-invert max-w-none text-foreground/80 space-y-5 mt-6 pb-2">
                <p className="text-sm md:text-base leading-relaxed">
                  {tr("about.storyParagraph1")}
                </p>
                <p className="text-sm md:text-base leading-relaxed">
                  {tr("about.storyParagraph2")}
                </p>
              </div>
            </div>

            {/* Architecture Process */}
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">{tr("about.architecture")}</h2>
              <div className="w-16 h-1 flex-shrink-0 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.6)]"></div>
              
              <div className="prose prose-invert max-w-none text-foreground/80 space-y-5 mt-6">
                <p className="text-sm md:text-base leading-relaxed">
                  {tr("about.architectureParagraph1")}
                </p>
                <p className="text-sm md:text-base leading-relaxed">
                  {tr("about.architectureParagraph2")}
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
              <h2 className="text-2xl md:text-3xl font-bold tracking-wider uppercase text-foreground/90">{tr("about.coreTeam")}</h2>
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
                  {tr("about.whyChoose")} <span className="neon-text bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">Sentra?</span>
                </h2>
                <p className="text-foreground/70 text-base md:text-lg pt-2 leading-relaxed">
                  {tr("about.whyChooseDesc")}
                </p>
              </div>

              <div className="space-y-5">
                {/* Feature 1 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">{tr("about.feature1Title")}</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    {tr("about.feature1Desc")}
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-purple-500/20 relative overflow-hidden group transition-all hover:border-purple-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-purple-400 mb-2">{tr("about.feature2Title")}</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    {tr("about.feature2Desc")}
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="glass-panel p-5 md:p-6 rounded-xl border border-cyan-500/20 relative overflow-hidden group transition-all hover:border-cyan-500/40">
                  <h3 className="text-lg md:text-xl font-bold text-cyan-400 mb-2">{tr("about.feature3Title")}</h3>
                  <p className="text-foreground/80 text-sm md:text-base">
                    {tr("about.feature3Desc")}
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
