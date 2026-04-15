/**
 * Tests for the async scan flow in the ScanEmailPage.
 *
 * TDD: Written BEFORE implementing polling in the page component.
 *
 * Tests:
 * 1. Shows "Analysing…" state after POST returns job_id
 * 2. Renders VerdictDisplay when polling returns complete status
 * 3. Stops polling after complete result (fetch called finite number of times)
 * 4. Shows error state when polling returns failed status
 * 5. Clears polling on component unmount (no further fetches after unmount)
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach,  } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — set up BEFORE importing the page
// ---------------------------------------------------------------------------

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { accessToken: 'test-token' },
    status: 'authenticated',
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/dashboard/user/scan'),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({
        children,
        initial: _i,
        animate: _a,
        transition: _t,
        variants: _v,
        exit: _e,
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
  useAnimation: () => ({ start: vi.fn() }),
}))

vi.mock('lucide-react', () => ({
  ScanText:     ({ size: _s }: { size?: number }) => <svg data-testid="scan-text-icon" />,
  AlertTriangle: () => <svg data-testid="alert-icon" />,
  ShieldCheck:  ({ size: _s, className: _c }: { size?: number; className?: string }) => (
    <svg data-testid="shield-check-icon" />
  ),
  ShieldAlert:  () => <svg data-testid="shield-alert-icon" />,
  HelpCircle:   () => <svg data-testid="help-icon" />,
  Loader2:      ({ size: _s, className: _c }: { size?: number; className?: string }) => (
    <svg data-testid="loader-icon" />
  ),
  Shield:       () => <svg data-testid="shield-icon" />,
  Copy:         () => <svg data-testid="copy-icon" />,
}))

vi.mock('@/components/scan/ScanHistoryPanel', () => ({
  default: () => <div data-testid="scan-history-panel" />,
}))

vi.mock('@/components/scan/VerdictDisplay', () => ({
  default: ({ verdict }: { verdict: string }) => (
    <div data-testid="verdict-display" data-verdict={verdict}>
      {verdict === 'phishing' ? 'PHISHING' : 'SAFE'}
    </div>
  ),
}))

vi.mock('@/lib/config', () => ({
  config: {
    API: {
      BASE_URL: 'http://localhost:5000',
    },
  },
}))

// ---------------------------------------------------------------------------
// Controllable mock for user-api
// ---------------------------------------------------------------------------

const mockScanEmail = vi.fn()
const mockGetScanStatus = vi.fn()

vi.mock('@/lib/user-api', () => ({
  scanEmail: (...args: unknown[]) => mockScanEmail(...args),
  getScanStatus: (...args: unknown[]) => mockGetScanStatus(...args),
  getScanHistory: () => Promise.resolve({ scans: [], total: 0, pages: 1 }),
}))

// ---------------------------------------------------------------------------
// Import page AFTER all mocks are in place
// ---------------------------------------------------------------------------

import ScanEmailPage from '@/app/dashboard/user/scan/page'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_BODY = 'Click here to claim your prize!'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScanEmailPage — async polling flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- Test 1: Loading state immediately after submit -----

  it('shows Analysing state immediately after form submit', async () => {
    // scanEmail never resolves during this test — we just want the in-progress state
    mockScanEmail.mockReturnValue(new Promise(() => {}))

    const user = userEvent.setup()
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // The button should now show the analysing state — check the button text OR the status panel
    await waitFor(() => {
      // Check button text changed to Analysing or the right panel shows the analyzing message
      const analysingBtn = screen.queryByText('Analysing…')
      const analysingPanel = screen.queryByText(/analysing your email/i)
      const loaderIcon = screen.queryByTestId('loader-icon')
      expect(analysingBtn || analysingPanel || loaderIcon).toBeTruthy()
    }, { timeout: 2000 })
  })

  // ----- Test 2: VerdictDisplay shown on complete -----

  it('renders VerdictDisplay when polling returns complete status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockScanEmail.mockResolvedValue({ job_id: 'completed-job-456', status: 'queued' })
    mockGetScanStatus.mockResolvedValue({
      status: 'complete',
      verdict: 'phishing',
      confidence: 0.92,
      scam_score: 88,
      reasoning: 'Suspicious links detected.',
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // Advance to trigger the first polling interval (1500ms)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(screen.getByTestId('verdict-display')).toBeTruthy()
    })

    vi.useRealTimers()
  })

  // ----- Test 3: Polling stops after complete -----

  it('stops polling after receiving a complete result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockScanEmail.mockResolvedValue({ job_id: 'finite-poll-job', status: 'queued' })
    mockGetScanStatus.mockResolvedValue({
      status: 'complete',
      verdict: 'legitimate',
      confidence: 0.95,
      scam_score: 2,
      reasoning: 'Safe email.',
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // Trigger first poll
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockGetScanStatus).toHaveBeenCalled()
    })

    const callsAfterFirstPoll = mockGetScanStatus.mock.calls.length

    // Advance a lot more — no new polls should fire because we got 'complete'
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockGetScanStatus.mock.calls.length).toBe(callsAfterFirstPoll)

    vi.useRealTimers()
  })

  // ----- Test 4: Error state on failed status -----

  it('shows error message when polling returns failed status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockScanEmail.mockResolvedValue({ job_id: 'failed-job-789', status: 'queued' })
    mockGetScanStatus.mockResolvedValue({
      status: 'failed',
      error: 'Detection service unavailable',
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      const errorEl = screen.queryByText(/detection service unavailable/i) ||
        screen.queryByText(/failed/i)
      expect(errorEl).toBeTruthy()
    })

    vi.useRealTimers()
  })

  // ----- Test 6: Cache hit — renders VerdictDisplay immediately, no polling -----

  it('renders VerdictDisplay immediately when scanEmail returns a cache hit (status 200)', async () => {
    // scanEmail returns status='complete' and cached=true (200 response from server)
    mockScanEmail.mockResolvedValue({
      status: 'complete',
      cached: true,
      verdict: 'phishing',
      confidence: 0.95,
      scam_score: 90,
      reasoning: 'Cached result: suspicious links detected.',
    })

    const user = userEvent.setup()
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // Should render verdict display without any polling
    await waitFor(() => {
      expect(screen.getByTestId('verdict-display')).toBeTruthy()
    }, { timeout: 2000 })

    // getScanStatus must NOT have been called — no polling for cache hits
    expect(mockGetScanStatus).not.toHaveBeenCalled()
  })

  // ----- Test 7: Cache hit — no polling interval set -----

  it('does not start polling interval when scanEmail returns a cached result', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockScanEmail.mockResolvedValue({
      status: 'complete',
      cached: true,
      verdict: 'legitimate',
      confidence: 0.98,
      scam_score: 2,
      reasoning: 'Cached: safe email.',
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // Advance time — no polling should occur
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })

    expect(mockGetScanStatus).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  // ----- Test 8: Cache hit shows correct verdict -----

  it('shows the correct verdict from a cached inline response', async () => {
    mockScanEmail.mockResolvedValue({
      status: 'complete',
      cached: true,
      verdict: 'phishing',
      confidence: 0.99,
      scam_score: 95,
      reasoning: 'Cached: known phishing domain.',
    })

    const user = userEvent.setup()
    render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    await waitFor(() => {
      const verdictEl = screen.getByTestId('verdict-display')
      expect(verdictEl).toBeTruthy()
      // The mock VerdictDisplay renders 'PHISHING' for phishing verdict
      expect(verdictEl.textContent).toContain('PHISHING')
    }, { timeout: 2000 })
  })

  // ----- Test 5: Interval cleared on unmount -----

  it('does not call getScanStatus after component unmounts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockScanEmail.mockResolvedValue({ job_id: 'unmount-job', status: 'queued' })
    mockGetScanStatus.mockResolvedValue({ status: 'pending' })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    const { unmount } = render(<ScanEmailPage />)

    const bodyInput = screen.getByPlaceholderText(/paste the full email body/i)
    await user.type(bodyInput, SAMPLE_BODY)

    const submitButton = screen.getByRole('button', { name: /scan email/i })
    await user.click(submitButton)

    // Unmount before polling starts
    unmount()

    const callsAtUnmount = mockGetScanStatus.mock.calls.length

    // Advance timers — no new calls should fire
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })

    expect(mockGetScanStatus.mock.calls.length).toBe(callsAtUnmount)

    vi.useRealTimers()
  })
})
