import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock framer-motion
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({
        children,
        initial: _i,
        animate: _a,
        transition: _t,
        variants: _v,
        ...props
      }: Record<string, unknown>) =>
        React.createElement(
          tag as keyof React.JSX.IntrinsicElements,
          props as Record<string, unknown>,
          children as React.ReactNode
        )
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Mock recharts — replace all chart components with testable stubs
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey }: { dataKey: string }) =>
    <div data-testid={`line-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="responsive-container">{children}</div>,
  LinearGradient: ({ children }: { children: React.ReactNode }) =>
    <defs>{children}</defs>,
  defs: ({ children }: { children: React.ReactNode }) => <defs>{children}</defs>,
  stop: () => <stop />,
}))

// ---------------------------------------------------------------------------
// Mock lucide-react
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  Brain:   () => <svg data-testid="brain-icon" />,
  Target:  () => <svg data-testid="target-icon" />,
  TrendingUp: () => <svg data-testid="trending-icon" />,
  AlertTriangle: () => <svg data-testid="alert-icon" />,
  Database: () => <svg data-testid="database-icon" />,
}))

import type { IntelligenceStats, CacheStats } from '@/lib/admin-api'
import IntelligencePanel from '@/components/admin/IntelligencePanel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStats(overrides: Partial<IntelligenceStats> = {}): IntelligenceStats {
  return {
    confidence_distribution: [
      { bucket: '0-20%',   count: 5  },
      { bucket: '20-40%',  count: 12 },
      { bucket: '40-60%',  count: 8  },
      { bucket: '60-80%',  count: 15 },
      { bucket: '80-100%', count: 30 },
    ],
    accuracy_over_rounds: [
      { round_id: 1, accuracy: 0.72, completed_at: '2026-01-01T00:00:00' },
      { round_id: 2, accuracy: 0.88, completed_at: '2026-02-01T00:00:00' },
    ],
    fp_fn_rates: [
      { round_id: 1, false_positive_rate: 0.05, false_negative_rate: 0.12 },
      { round_id: 2, false_positive_rate: 0.02, false_negative_rate: 0.08 },
    ],
    top_phishing_words: [
      { word: 'urgent',  count: 45 },
      { word: 'verify',  count: 30 },
      { word: 'account', count: 22 },
      { word: 'secure',  count: 18 },
      { word: 'click',   count: 12 },
    ],
    ...overrides,
  }
}

const CACHE_STATS_AVAILABLE: CacheStats = { cached_keys: 42, available: true }
const CACHE_STATS_UNAVAILABLE: CacheStats = { cached_keys: 0, available: false }

const EMPTY_STATS: IntelligenceStats = {
  confidence_distribution: [],
  accuracy_over_rounds: [],
  fp_fn_rates: [],
  top_phishing_words: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntelligencePanel', () => {

  // -------------------------------------------------------------------------
  // 1. Cache stats chip
  // -------------------------------------------------------------------------
  describe('cache stats chip', () => {
    it('renders cache chip with key count when available', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      const chip = screen.getByTestId('cache-stats-chip')
      expect(chip.textContent).toMatch(/42/)
    })

    it('renders cache chip when unavailable', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_UNAVAILABLE} />)
      const chip = screen.getByTestId('cache-stats-chip')
      expect(chip.textContent).toMatch(/0/)
    })
  })

  // -------------------------------------------------------------------------
  // 2. Confidence distribution chart
  // -------------------------------------------------------------------------
  describe('confidence distribution chart', () => {
    it('renders a BarChart for confidence distribution', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      expect(screen.getByTestId('confidence-distribution-chart')).toBeTruthy()
    })

    it('renders inside the chart container', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      const chart = screen.getByTestId('confidence-distribution-chart')
      expect(chart.querySelector('[data-testid="bar-chart"]')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 3. Accuracy trend chart
  // -------------------------------------------------------------------------
  describe('accuracy trend chart', () => {
    it('renders a LineChart for accuracy over rounds', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      expect(screen.getByTestId('accuracy-trend-chart')).toBeTruthy()
    })

    it('contains a line element for accuracy', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      const chart = screen.getByTestId('accuracy-trend-chart')
      expect(chart.querySelector('[data-testid="line-accuracy"]')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 4. FP/FN rates chart
  // -------------------------------------------------------------------------
  describe('FP/FN rates chart', () => {
    it('renders a dual-line chart for FP and FN rates', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      expect(screen.getByTestId('fpfn-rates-chart')).toBeTruthy()
    })

    it('contains line elements for both FP and FN rates', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      const chart = screen.getByTestId('fpfn-rates-chart')
      expect(chart.querySelector('[data-testid="line-false_positive_rate"]')).toBeTruthy()
      expect(chart.querySelector('[data-testid="line-false_negative_rate"]')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 5. Word chip cloud
  // -------------------------------------------------------------------------
  describe('top phishing words chip cloud', () => {
    it('renders a chip for each top phishing word', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      const wordCloud = screen.getByTestId('word-cloud')
      const chips = wordCloud.querySelectorAll('[data-testid^="word-chip-"]')
      expect(chips.length).toBe(5)
    })

    it('renders chip text matching the word', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      expect(screen.getByTestId('word-chip-urgent').textContent).toBe('urgent')
    })
  })

  // -------------------------------------------------------------------------
  // 6. data-testid on word chips
  // -------------------------------------------------------------------------
  describe('word chip data-testid attributes', () => {
    it('each word chip has data-testid="word-chip-{word}"', () => {
      render(<IntelligencePanel stats={makeStats()} cacheStats={CACHE_STATS_AVAILABLE} />)
      expect(screen.getByTestId('word-chip-urgent')).toBeTruthy()
      expect(screen.getByTestId('word-chip-verify')).toBeTruthy()
      expect(screen.getByTestId('word-chip-account')).toBeTruthy()
      expect(screen.getByTestId('word-chip-secure')).toBeTruthy()
      expect(screen.getByTestId('word-chip-click')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 7. Empty data "No data available" message
  // -------------------------------------------------------------------------
  describe('empty data states', () => {
    it('shows "No data available" when confidence_distribution is empty', () => {
      render(<IntelligencePanel stats={makeStats({ confidence_distribution: [] })} cacheStats={CACHE_STATS_AVAILABLE} />)
      const panel = screen.getByTestId('confidence-distribution-chart')
      expect(panel.textContent).toMatch(/no data available/i)
    })

    it('shows "No rounds completed yet" when accuracy_over_rounds is empty', () => {
      render(<IntelligencePanel stats={makeStats({ accuracy_over_rounds: [] })} cacheStats={CACHE_STATS_AVAILABLE} />)
      const panel = screen.getByTestId('accuracy-trend-chart')
      expect(panel.textContent).toMatch(/no rounds completed yet/i)
    })

    it('shows "No rounds completed yet" when fp_fn_rates is empty', () => {
      render(<IntelligencePanel stats={makeStats({ fp_fn_rates: [] })} cacheStats={CACHE_STATS_AVAILABLE} />)
      const panel = screen.getByTestId('fpfn-rates-chart')
      expect(panel.textContent).toMatch(/no rounds completed yet/i)
    })

    it('shows "No data available" when top_phishing_words is empty', () => {
      render(<IntelligencePanel stats={makeStats({ top_phishing_words: [] })} cacheStats={CACHE_STATS_AVAILABLE} />)
      const panel = screen.getByTestId('word-cloud')
      expect(panel.textContent).toMatch(/no data available/i)
    })

    it('renders empty states for all sections when all arrays are empty', () => {
      render(<IntelligencePanel stats={EMPTY_STATS} cacheStats={CACHE_STATS_AVAILABLE} />)
      // Confidence distribution + word cloud use "No data available"
      const noDataMessages = screen.getAllByText(/no data available/i)
      expect(noDataMessages.length).toBeGreaterThanOrEqual(2)
      // Accuracy + FP/FN charts use "No rounds completed yet"
      const noRoundsMessages = screen.getAllByText(/no rounds completed yet/i)
      expect(noRoundsMessages.length).toBeGreaterThanOrEqual(2)
    })
  })
})
