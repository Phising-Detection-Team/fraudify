"use client";

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Brain, Database } from "lucide-react";
import { type IntelligenceStats, type CacheStats } from "@/lib/admin-api";
import { useLanguage } from "@/components/LanguageProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  stats: IntelligenceStats;
  cacheStats: CacheStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionClass() {
  return "glass-panel rounded-xl p-4";
}

// Word chip font size: linearly scaled between 11px (min count) and 18px (max count)
function chipFontSize(count: number, min: number, max: number): number {
  if (max === min) return 14;
  return Math.round(11 + ((count - min) / (max - min)) * 7);
}

// Word chip color: cyan (#00D4FF) at low frequency, red (#ef4444) at high frequency
function chipColor(count: number, min: number, max: number): string {
  if (max === min) return "#00D4FF";
  const t = (count - min) / (max - min);
  const r = Math.round(0 + t * 239);
  const g = Math.round(212 - t * 144);
  const b = Math.round(255 - t * 187);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceDistributionChart({
  data,
  tr,
}: {
  data: IntelligenceStats["confidence_distribution"];
  tr: (key: string) => string;
}) {
  const hasData = data.some((d) => d.count > 0);
  return (
    <div className={sectionClass()} data-testid="confidence-distribution-chart">
      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
        {tr("intelligence.confidenceDistribution")}
      </h4>
      {!hasData ? (
        <p className="text-xs text-muted-foreground text-center py-4">{tr("intelligence.noData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#00D4FF" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function AccuracyTrendChart({
  data,
  tr,
}: {
  data: IntelligenceStats["accuracy_over_rounds"];
  tr: (key: string) => string;
}) {
  return (
    <div className={sectionClass()} data-testid="accuracy-trend-chart">
      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
        {tr("intelligence.accuracyTrend")}
      </h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{tr("intelligence.noRounds")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey="round_id" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : ''} />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#00D4FF"
              strokeWidth={2}
              dot={{ r: 3, fill: "#00D4FF" }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function FpFnRatesChart({
  data,
  tr,
}: {
  data: IntelligenceStats["fp_fn_rates"];
  tr: (key: string) => string;
}) {
  return (
    <div className={sectionClass()} data-testid="fpfn-rates-chart">
      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
        {tr("intelligence.fpFnRates")}
      </h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{tr("intelligence.noRounds")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
            <XAxis dataKey="round_id" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: unknown) => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : ''} />
            <Line
              type="monotone"
              dataKey="false_positive_rate"
              stroke="#f87171"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f87171" }}
              name="FP Rate"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="false_negative_rate"
              stroke="#fb923c"
              strokeWidth={2}
              dot={{ r: 3, fill: "#fb923c" }}
              name="FN Rate"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function WordChipCloud({
  data,
  tr,
}: {
  data: IntelligenceStats["top_phishing_words"];
  tr: (key: string) => string;
}) {
  const counts = data.map((w) => w.count);
  const minCount = counts.length > 0 ? Math.min(...counts) : 0;
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

  return (
    <div className={sectionClass()} data-testid="word-cloud">
      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
        {tr("intelligence.topPhishingWords")}
      </h4>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{tr("intelligence.noData")}</p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {data.map(({ word, count }) => (
            <span
              key={word}
              data-testid={`word-chip-${word}`}
              className="px-2 py-0.5 rounded-full font-medium cursor-default select-none"
              style={{
                fontSize: chipFontSize(count, minCount, maxCount),
                color: chipColor(count, minCount, maxCount),
                border: `1px solid ${chipColor(count, minCount, maxCount)}40`,
                background: `${chipColor(count, minCount, maxCount)}12`,
              }}
            >
              {word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IntelligencePanel({ stats, cacheStats }: Props) {
  const { tr } = useLanguage();
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Brain size={20} className="text-accent-cyan" />
        <h2 className="text-xl font-bold tracking-tight">{tr("intelligence.title")}</h2>
        <span
          data-testid="cache-stats-chip"
          className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            cacheStats.available
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              : 'bg-muted/10 border-muted/30 text-muted-foreground'
          }`}
        >
          <Database size={11} />
          {tr("intelligence.cache")}: {cacheStats.cached_keys} {tr("intelligence.entries")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfidenceDistributionChart data={stats.confidence_distribution} tr={tr} />
        <AccuracyTrendChart data={stats.accuracy_over_rounds} tr={tr} />
        <FpFnRatesChart data={stats.fp_fn_rates} tr={tr} />
        <WordChipCloud data={stats.top_phishing_words} tr={tr} />
      </div>
    </div>
  );
}
