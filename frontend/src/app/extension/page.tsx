"use client";

import { Download, Chrome, Shield, Mail, Zap, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function ExtensionPage() {
  const { tr } = useLanguage();
  const installSteps = [
    {
      step: 1,
      title: tr("extension.step1Title"),
      description: (
        <>
          {tr("extension.step1DescPrefix")}{" "}
          <code className="px-1.5 py-0.5 bg-background/60 rounded text-accent-cyan text-xs">chrome://extensions</code> (Chrome) {tr("extension.or")}{" "}
          <code className="px-1.5 py-0.5 bg-background/60 rounded text-accent-cyan text-xs">edge://extensions</code> (Edge) {tr("extension.step1DescSuffix")}{" "}
          <strong>{tr("extension.developerMode")}</strong> {tr("extension.on")}.
        </>
      ),
    },
    {
      step: 2,
      title: tr("extension.step2Title"),
      description: (
        <>
          {tr("extension.step2DescPrefix")} <strong>{tr("extension.step2DescStrong")}</strong> {tr("extension.step2DescSuffix")}
        </>
      ),
    },
    {
      step: 3,
      title: tr("extension.step3Title"),
      description: (
        <>
          {tr("extension.step3DescPrefix")} <strong>{tr("extension.step3DescStrong")}</strong> {tr("extension.andSelect")}{" "}
          <code className="px-1.5 py-0.5 bg-background/60 rounded text-accent-cyan text-xs">extension/</code> {tr("extension.step3DescSuffix")}
        </>
      ),
    },
    {
      step: 4,
      title: tr("extension.step4Title"),
      description: <>{tr("extension.step4Desc")}</>,
    },
    {
      step: 5,
      title: tr("extension.step5Title"),
      description: <>{tr("extension.step5Desc")}</>,
    },
  ];

  const features = [
    {
      icon: <Shield size={18} className="text-accent-cyan" />,
      title: tr("extension.feature1Title"),
      description: tr("extension.feature1Desc"),
    },
    {
      icon: <Mail size={18} className="text-accent-purple" />,
      title: tr("extension.feature2Title"),
      description: tr("extension.feature2Desc"),
    },
    {
      icon: <Zap size={18} className="text-accent-yellow" />,
      title: tr("extension.feature3Title"),
      description: tr("extension.feature3Desc"),
    },
  ];

  const compatibilityItems = [
    tr("extension.compat1"),
    tr("extension.compat2"),
    tr("extension.compat3"),
    tr("extension.compat4"),
  ];

  return (
    <div className="min-h-screen bg-background py-16 px-8">
      <div className="max-w-3xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-semibold uppercase tracking-wider mb-2">
            <Chrome size={12} /> {tr("extension.badge")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            {tr("extension.title")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {tr("extension.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="#install"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-cyan text-background font-semibold rounded-lg hover:bg-accent-cyan/90 transition-colors text-sm"
            >
              <Download size={16} />
              {tr("extension.installNow")}
            </a>
            <Link
              href="/dashboard/user"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border/50 rounded-lg hover:border-accent-cyan/30 transition-colors text-sm text-muted-foreground hover:text-foreground"
            >
              {tr("extension.goDashboard")}
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-panel p-5 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                {f.icon}
                <span className="font-semibold text-sm">{f.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Install Steps */}
        <div id="install" className="space-y-4">
          <h2 className="text-xl font-bold">{tr("extension.installGuide")}</h2>
          <ol className="space-y-3">
            {installSteps.map(({ step, title, description }) => (
              <li key={step} className="glass-panel p-5 rounded-xl flex gap-4 items-start" data-testid="install-step">
                <span className="shrink-0 w-7 h-7 rounded-full bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 flex items-center justify-center text-xs font-bold">
                  {step}
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Compatibility */}
        <div className="glass-panel p-6 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{tr("extension.compatibility")}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {compatibilityItems.map((item) => (
              <div key={item} className="flex items-center gap-2 text-foreground/80">
                <CheckCircle2 size={14} className="text-accent-green shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
