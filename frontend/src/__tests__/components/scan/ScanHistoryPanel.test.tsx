import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock recharts — SVG/canvas is not available in jsdom
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-line-chart">{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`recharts-line-${dataKey}`} />
  ),
  XAxis: () => <div data-testid="recharts-x-axis" />,
  YAxis: () => <div data-testid="recharts-y-axis" />,
  Tooltip: () => <div data-testid="recharts-tooltip" />,
  Legend: () => <div data-testid="recharts-legend" />,
  CartesianGrid: () => <div data-testid="recharts-grid" />,
}))

// ---------------------------------------------------------------------------
// Mock framer-motion
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({ children, initial: _i, animate: _a, transition: _t, variants: _v, ...props }: Record<string, unknown>) =>
        React.createElement(tag as keyof React.JSX.IntrinsicElements, props as Record<string, unknown>, children as React.ReactNode)
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Mock lucide-react
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  History: () => <svg data-testid="history-icon" />,
  ChevronDown: () => <svg data-testid="chevron-down-icon" />,
  ChevronUp: () => <svg data-testid="chevron-up-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  Mail: () => <svg data-testid="mail-icon" />,
  Brain: () => <svg data-testid="brain-icon" />,
  X: () => <svg data-testid="x-icon" />,
  ShieldAlert: () => <svg data-testid="shield-alert-icon" />,
  ShieldCheck: () => <svg data-testid="shield-check-icon" />,
  HelpCircle: () => <svg data-testid="help-circle-icon" />,
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
}))

// ---------------------------------------------------------------------------
// Mock user-api
// ---------------------------------------------------------------------------
vi.mock('@/lib/user-api', () => ({
  getScanHistory: vi.fn(),
}))

import { getScanHistory } from '@/lib/user-api'
import type { ScanHistoryItem } from '@/lib/user-api'
import ScanHistoryPanel from '@/components/scan/ScanHistoryPanel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ScanHistoryItem> = {}): ScanHistoryItem {
  // Use a recent date so chart data falls within the 30-day window
  const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: 1,
    user_id: 42,
    subject: 'Test subject',
    body_snippet: 'Email body snippet',
    verdict: 'legitimate',
    confidence: 0.95,
    scam_score: 5,
    reasoning: 'This email looks safe because it comes from a known sender.',
    scanned_at: recentDate,
    ...overrides,
  }
}

const mockScanHistory = {
  scans: [
    makeEntry({ id: 1, subject: 'Hello from trusted sender', verdict: 'legitimate', confidence: 0.95 }),
    makeEntry({ id: 2, subject: 'Urgent: verify your account NOW', verdict: 'phishing', confidence: 0.98 }),
    makeEntry({ id: 3, subject: 'You have won a prize', verdict: 'phishing', confidence: 0.87 }),
    makeEntry({ id: 4, subject: 'Meeting notes for Q3', verdict: 'likely_legitimate', confidence: 0.82 }),
    makeEntry({ id: 5, subject: 'Suspicious activity detected', verdict: 'suspicious', confidence: 0.65 }),
  ],
  total: 5,
  pages: 1,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScanHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows loading skeleton while fetching', async () => {
      // Never resolve — keep loading indefinitely
      vi.mocked(getScanHistory).mockReturnValue(new Promise(() => {}))

      render(<ScanHistoryPanel token="test-token" />)

      expect(screen.getByTestId('scan-history-loading')).toBeTruthy()
    })

    it('hides loading skeleton after data is fetched', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.queryByTestId('scan-history-loading')).toBeNull()
      })
    })
  })

  // -------------------------------------------------------------------------
  // Summary stats
  // -------------------------------------------------------------------------

  describe('summary stats', () => {
    it('renders total scan count from fetched data', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('stat-total')).toBeTruthy()
      })

      const totalEl = screen.getByTestId('stat-total')
      expect(totalEl.textContent).toContain('5')
    })

    it('renders phishing percentage correctly', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('stat-phishing-pct')).toBeTruthy()
      })

      // 2 phishing out of 5 = 40%
      const phishingEl = screen.getByTestId('stat-phishing-pct')
      expect(phishingEl.textContent).toContain('40')
    })

    it('renders safe percentage correctly', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('stat-safe-pct')).toBeTruthy()
      })

      // legitimate + likely_legitimate = 2, out of 5 = 40%
      const safeEl = screen.getByTestId('stat-safe-pct')
      expect(safeEl.textContent).toContain('40')
    })
  })

  // -------------------------------------------------------------------------
  // Chart
  // -------------------------------------------------------------------------

  describe('line chart', () => {
    it('renders the recharts line chart container', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('recharts-responsive-container')).toBeTruthy()
      })
    })

    it('renders a phishing line and a safe line', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('recharts-line-phishing')).toBeTruthy()
        expect(screen.getByTestId('recharts-line-safe')).toBeTruthy()
      })
    })
  })

  // -------------------------------------------------------------------------
  // History table
  // -------------------------------------------------------------------------

  describe('history table', () => {
    it('renders a row for each scan entry', async () => {
      vi.mocked(getScanHistory).mockResolvedValue(mockScanHistory)

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByText('Hello from trusted sender')).toBeTruthy()
      })

      expect(screen.getByText('Urgent: verify your account NOW')).toBeTruthy()
      expect(screen.getByText('You have won a prize')).toBeTruthy()
    })

    it('truncates long subjects to 50 characters', async () => {
      const longSubject = 'A'.repeat(60)
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ subject: longSubject })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('scan-row-1')).toBeTruthy()
      })

      const displayedSubject = screen.getByTestId('scan-subject-1').textContent ?? ''
      expect(displayedSubject.length).toBeLessThanOrEqual(53) // 50 chars + "..."
    })

    it('renders verdict badge for each entry', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ id: 1, verdict: 'phishing' })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('verdict-badge-1')).toBeTruthy()
      })
    })

    it('renders confidence bar for each entry', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ id: 1, confidence: 0.75 })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('confidence-bar-1')).toBeTruthy()
      })
    })

    it('shows "No scans yet" when data is empty', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({ scans: [], total: 0, pages: 1 })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('no-scans-message')).toBeTruthy()
      })

      expect(screen.getByTestId('no-scans-message').textContent).toMatch(/no scans yet/i)
    })
  })

  // -------------------------------------------------------------------------
  // Row expansion (reasoning)
  // -------------------------------------------------------------------------

  describe('row expansion', () => {
    it('does not show reasoning text by default', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ id: 1, reasoning: 'Full reasoning text here.' })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('scan-row-1')).toBeTruthy()
      })

      expect(screen.queryByText('Full reasoning text here.')).toBeNull()
    })

    it('shows reasoning text when row is clicked', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ id: 1, reasoning: 'Full reasoning text here.' })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('scan-row-1')).toBeTruthy()
      })

      fireEvent.click(screen.getByTestId('scan-row-1'))

      await waitFor(() => {
        expect(screen.getByText('Full reasoning text here.')).toBeTruthy()
      })
    })

    it('hides reasoning text when the detail modal is closed', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        scans: [makeEntry({ id: 1, reasoning: 'Full reasoning text here.' })],
        total: 1,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('scan-row-1')).toBeTruthy()
      })

      fireEvent.click(screen.getByTestId('scan-row-1'))
      await waitFor(() => expect(screen.getByText('Full reasoning text here.')).toBeTruthy())

      const closeBtn = screen.getByTestId('x-icon').closest('button')
      expect(closeBtn).toBeTruthy()
      fireEvent.click(closeBtn!)

      await waitFor(() => expect(screen.queryByText('Full reasoning text here.')).toBeNull())
    })
  })

  // -------------------------------------------------------------------------
  // Load more / pagination
  // -------------------------------------------------------------------------

  describe('load more pagination', () => {
    it('shows "Load more" button when there are more pages', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        ...mockScanHistory,
        total: 25,
        pages: 2,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('load-more-btn')).toBeTruthy()
      })
    })

    it('does not show "Load more" button when on the last page', async () => {
      vi.mocked(getScanHistory).mockResolvedValue({
        ...mockScanHistory,
        total: 5,
        pages: 1,
      })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.queryByTestId('scan-history-loading')).toBeNull()
      })

      expect(screen.queryByTestId('load-more-btn')).toBeNull()
    })

    it('calls getScanHistory with page 2 when "Load more" is clicked', async () => {
      vi.mocked(getScanHistory)
        .mockResolvedValueOnce({ ...mockScanHistory, pages: 2, total: 25 })
        .mockResolvedValueOnce({ ...mockScanHistory, pages: 2, total: 25 })

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.getByTestId('load-more-btn')).toBeTruthy()
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('load-more-btn'))
      })

      expect(vi.mocked(getScanHistory)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(getScanHistory)).toHaveBeenNthCalledWith(2, 'test-token', 2, 20)
    })
  })

  // -------------------------------------------------------------------------
  // Error / edge cases
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('renders empty state when getScanHistory throws', async () => {
      vi.mocked(getScanHistory).mockRejectedValue(new Error('Network error'))

      await act(async () => {
        render(<ScanHistoryPanel token="test-token" />)
      })

      await waitFor(() => {
        expect(screen.queryByTestId('scan-history-loading')).toBeNull()
      })

      expect(screen.getByTestId('no-scans-message')).toBeTruthy()
    })
  })
})
