import React, { useState } from "react";
import Image from "next/image";
import { Link2, Github, Linkedin, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

export interface TeamMember {
  name: string;
  role: string;
  photo?: string;
  affiliation?: string;
  bio?: string;
  contributions?: (string | React.ReactNode)[];
  skills?: string[];
  links?: {
    portfolio?: string;
    linkedin?: string;
    github?: string;
  };
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

function Avatar({
  photo,
  name,
  className,
  sizes,
}: {
  photo?: string;
  name: string;
  className: string;
  /** Display width hint for srcset (fill layout); avoids soft or blocky downscales. */
  sizes: string;
}) {
  if (photo) {
    return (
      <Image
        src={photo}
        alt={name}
        fill
        sizes={sizes}
        quality={92}
        className={`object-cover object-top contrast-[1.07] saturate-[1.06] brightness-[1.02] ${className}`}
      />
    );
  }
  return (
    <span className="text-4xl font-bold tracking-wide neon-text">
      {name.charAt(0)}
    </span>
  );
}

export const TeamCard: React.FC<{ member: TeamMember }> = ({ member }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        className="glass-panel p-6 rounded-xl flex flex-col justify-between items-center text-center space-y-4 relative group overflow-hidden cursor-pointer min-h-[320px] shadow-lg hover:shadow-cyan-500/20"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="flex flex-col items-center space-y-4 mt-2">
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 p-[2px] flex-shrink-0 cursor-pointer shadow-md group-hover:shadow-[0_0_25px_rgba(0,255,255,0.4)] transition-shadow duration-300">
            <div className="relative w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
              <Avatar
                photo={member.photo}
                name={member.name}
                className="rounded-full"
                sizes="128px"
              />
            </div>
          </div>

          <div className="z-10">
            <h3 className="text-xl font-bold text-foreground group-hover:text-cyan-400 transition-colors duration-300">{member.name}</h3>
            <p className="text-sm font-medium text-cyan-500/80 tracking-wide mt-1">{member.role}</p>
            {member.affiliation && (
              <p className="text-xs text-muted-foreground mt-1">{member.affiliation}</p>
            )}
          </div>
        </div>

        {(member.links?.portfolio || member.links?.linkedin || member.links?.github) && (
          <div className="flex items-center justify-center gap-4 z-10 py-1">
            {member.links.portfolio && (
              <a href={member.links.portfolio} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground/40 hover:text-cyan-500 hover:scale-110 transition-all" aria-label="Portfolio">
                <Link2 size={18} />
              </a>
            )}
            {member.links.linkedin && (
              <a href={member.links.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground/40 hover:text-cyan-500 hover:scale-110 transition-all" aria-label="LinkedIn">
                <Linkedin size={18} />
              </a>
            )}
            {member.links.github && (
              <a href={member.links.github} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-foreground/40 hover:text-cyan-500 hover:scale-110 transition-all" aria-label="GitHub">
                <Github size={18} />
              </a>
            )}
          </div>
        )}

        <div className="z-10 text-xs font-bold tracking-widest uppercase flex items-center mt-2 group-hover:text-cyan-400 transition-colors duration-300 bg-background/50 px-4 py-2 rounded-full border border-border/50 group-hover:border-cyan-500/30">
          View Profile <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl border border-border/50 shadow-[0_10px_40px_-10px_rgba(0,255,255,0.15)] z-10 bg-background/95"
            >
              {/* Modal Header Cover */}
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-r from-cyan-500/20 to-purple-500/20" />

              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-background/50 hover:bg-background rounded-full transition-colors z-20 backdrop-blur-md"
              >
                <X size={20} className="text-foreground" />
              </button>

              <div className="pt-20 px-8 pb-8 relative z-10">
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-500 p-[2px] shadow-lg flex-shrink-0">
                    <div className="relative w-full h-full rounded-[14px] bg-background flex items-center justify-center overflow-hidden">
                      <Avatar
                        photo={member.photo}
                        name={member.name}
                        className="rounded-[14px]"
                        sizes="(min-width: 768px) 160px, 128px"
                      />
                    </div>
                  </div>

                  <div className="flex-1 pb-2">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                      {member.name}
                    </h2>
                    <p className="text-lg md:text-xl text-cyan-500 font-medium mt-1">{member.role}</p>
                    {member.affiliation && (
                      <p className="text-sm md:text-base text-foreground/60 mt-1">{member.affiliation}</p>
                    )}

                    {(member.links?.portfolio || member.links?.linkedin || member.links?.github) && (
                      <div className="flex space-x-4 pt-3">
                        {member.links.portfolio && (
                          <a href={member.links.portfolio} target="_blank" rel="noreferrer" className="text-foreground/60 hover:text-cyan-500 transition-colors" aria-label="Portfolio">
                            <Link2 size={20} />
                          </a>
                        )}
                        {member.links.linkedin && (
                          <a href={member.links.linkedin} target="_blank" rel="noreferrer" className="text-foreground/60 hover:text-cyan-500 transition-colors" aria-label="LinkedIn">
                            <Linkedin size={20} />
                          </a>
                        )}
                        {member.links.github && (
                          <a href={member.links.github} target="_blank" rel="noreferrer" className="text-foreground/60 hover:text-cyan-500 transition-colors" aria-label="GitHub">
                            <Github size={20} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 space-y-6 text-left">
                  {member.bio && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">About</h4>
                      <p className="text-foreground/80 leading-relaxed text-sm md:text-base pt-1">
                        {member.bio}
                      </p>
                    </div>
                  )}

                  {member.contributions && member.contributions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Sentra Contributions</h4>
                      <ul className="space-y-2 pt-2">
                        {member.contributions.map((contribution, idx) => (
                          <li key={idx} className="flex items-start text-sm md:text-base text-foreground/80">
                            <span className="mr-3 text-cyan-500 opacity-70 mt-1">✦</span>
                            <span className="leading-relaxed font-medium">{contribution}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {member.skills && member.skills.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Core Tech Stack</h4>
                      <div className="flex flex-wrap gap-2.5 pt-2">
                        {member.skills.map((skill, idx) => (
                          <span key={idx} className="px-3.5 py-1.5 text-xs font-bold bg-accent-cyan/10 text-cyan-500 border border-cyan-500/20 rounded-full shadow-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
