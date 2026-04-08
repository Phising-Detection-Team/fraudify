import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const {
  mockSocketOn,
  mockSocketDisconnect,
  mockSocketOff,
  mockIo,
  capturedHandlers,
} = vi.hoisted(() => {
  const capturedHandlers: Record<string, (data: unknown) => void> = {}
  const mockSocketOn = vi.fn((event: string, handler: (data: unknown) => void) => {
    capturedHandlers[event] = handler
  })
  const mockSocketDisconnect = vi.fn()
  const mockSocketOff = vi.fn()
  const mockIo = vi.fn(() => ({
    on: mockSocketOn,
    disconnect: mockSocketDisconnect,
    off: mockSocketOff,
  }))
  return { mockSocketOn, mockSocketDisconnect, mockSocketOff, mockIo, capturedHandlers }
})

vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      accessToken: 'test-token',
      user: { fromBackend: true, role: 'admin', name: 'Test', email: 'test@test.com' },
    },
    status: 'authenticated',
  })),
}))

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: '42' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({
        children,
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        style,
        ...props
      }: Record<string, unknown>) =>
        React.createElement(
          tag as keyof React.JSX.IntrinsicElements,
          { ...props, style } as Record<string, unknown>,
          children as React.ReactNode
        )
      Component.displayName = `motion.${tag}`
      return Component
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', () => ({
  ShieldAlert: () => <svg data-testid="shield-alert-icon" />,
  ShieldCheck: () => <svg data-testid="shield-check-icon" />,
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Bot: () => <svg data-testid="bot-icon" />,
  Activity: () => <svg data-testid="activity-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  X: () => <svg data-testid="x-icon" />,
  Mail: () => <svg data-testid="mail-icon" />,
  Brain: () => <svg data-testid="brain-icon" />,
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
}))

vi.mock('@/lib/admin-api', () => ({
  getRound: vi.fn(),
  overrideEmailVerdict: vi.fn(),
}))

vi.mock('@/lib/config', () => ({
  config: {
    API: { BASE_URL: 'http://localhost:5000' },
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import { RoundDetailView } from '@/components/RoundDetail'
import { getRound } from '@/lib/admin-api'

const MOCK_ROUND = {
  id: '42',
  date: '2026-03-30T00:00:00Z',
  totalEmails: 10,
  detected: 5,
  detectionRate: 50,
  status: 'in_progress' as const,
  emails: [],
  apiCosts: [],
}

describe('RoundDetailView — WebSocket progress', () => {
  beforeEach(() => {
    // Clear call history but keep implementations
    mockSocketOn.mockClear()
    mockSocketDisconnect.mockClear()
    mockSocketOff.mockClear()
    mockIo.mockClear()
    // Clear captured handlers
    Object.keys(capturedHandlers).forEach((k) => delete capturedHandlers[k])

    localStorageMock.clear()

    mockIo.mockReturnValue({
      on: mockSocketOn,
      disconnect: mockSocketDisconnect,
      off: mockSocketOff,
    })

    vi.mocked(getRound).mockResolvedValue(MOCK_ROUND)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as unknown as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Renders without crashing
  // -------------------------------------------------------------------------
  it('renders without crashing', () => {
    render(<RoundDetailView />)
    expect(document.body).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // 2. Socket subscription
  // -------------------------------------------------------------------------
  it('connects to the socket server', () => {
    render(<RoundDetailView />)
    expect(mockIo).toHaveBeenCalled()
  })

  it('registers a round_progress event listener', () => {
    render(<RoundDetailView />)
    const registeredEvents = mockSocketOn.mock.calls.map(
      (call: unknown[]) => call[0]
    )
    expect(registeredEvents).toContain('round_progress')
  })

  it('disconnects the socket on unmount', () => {
    const { unmount } = render(<RoundDetailView />)
    unmount()
    expect(mockSocketDisconnect).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 3. Progress bar appears for matching round_id
  // -------------------------------------------------------------------------
  it('shows progress bar when round_progress event arrives for the current round', async () => {
    render(<RoundDetailView />)

    // Socket useEffect fires synchronously during render — handler is captured
    const handler = capturedHandlers['round_progress']
    expect(handler).toBeTruthy()

    act(() => {
      handler({
        round_id: 42,
        processed: 3,
        total: 10,
        verdict: 'phishing',
        accuracy: 0.66,
      })
    })

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="round-progress-bar"]')
      ).not.toBeNull()
    })
  })

  it('does not show progress bar before any round_progress event', () => {
    render(<RoundDetailView />)
    expect(
      document.querySelector('[data-testid="round-progress-bar"]')
    ).toBeNull()
  })

  it('ignores round_progress events for a different round_id', async () => {
    render(<RoundDetailView />)

    const handler = capturedHandlers['round_progress']
    expect(handler).toBeTruthy()

    act(() => {
      handler({
        round_id: 999,
        processed: 5,
        total: 10,
        verdict: 'safe',
        accuracy: 1.0,
      })
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(
      document.querySelector('[data-testid="round-progress-bar"]')
    ).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 4. Progress bar width reflects processed/total ratio
  // -------------------------------------------------------------------------
  it('progress bar fill width reflects processed/total ratio', async () => {
    render(<RoundDetailView />)

    const handler = capturedHandlers['round_progress']
    expect(handler).toBeTruthy()

    act(() => {
      handler({
        round_id: 42,
        processed: 5,
        total: 10,
        verdict: 'safe',
        accuracy: 1.0,
      })
    })

    await waitFor(() => {
      const progressFill = document.querySelector('[data-testid="round-progress-fill"]')
      expect(progressFill).not.toBeNull()
    })

    const progressFill = document.querySelector('[data-testid="round-progress-fill"]')
    const style = (progressFill as HTMLElement)?.style
    expect(style?.width).toBe('50%')
  })
})
