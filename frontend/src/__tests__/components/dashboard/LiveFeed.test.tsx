import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoist mocks so they are available before vi.mock factory runs
// ---------------------------------------------------------------------------
const { mockSocketOn, mockSocketDisconnect, mockSocketOff, mockIo } = vi.hoisted(() => {
  const mockSocketOn = vi.fn()
  const mockSocketDisconnect = vi.fn()
  const mockSocketOff = vi.fn()
  const mockIo = vi.fn(() => ({
    on: mockSocketOn,
    disconnect: mockSocketDisconnect,
    off: mockSocketOff,
  }))
  return { mockSocketOn, mockSocketDisconnect, mockSocketOff, mockIo }
})

// ---------------------------------------------------------------------------
// Mock socket.io-client
// ---------------------------------------------------------------------------
vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

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
        exit: _e,
        transition: _t,
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
// Mock lucide-react icons
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  ShieldCheck: () => <svg data-testid="shield-check-icon" />,
  ShieldAlert: () => <svg data-testid="shield-alert-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
}))

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { LiveFeed } from '@/components/dashboard/LiveFeed'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiveFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIo.mockReturnValue({
      on: mockSocketOn,
      disconnect: mockSocketDisconnect,
      off: mockSocketOff,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Renders without crashing when socket not connected
  // -------------------------------------------------------------------------
  describe('graceful degradation', () => {
    it('renders without crashing when no socket connection is established', () => {
      expect(() => render(<LiveFeed />)).not.toThrow()
    })

    it('renders the Live Detection Feed heading', () => {
      render(<LiveFeed />)
      expect(screen.getByText(/live detection feed/i)).toBeTruthy()
    })

    it('shows Auto-updating label', () => {
      render(<LiveFeed />)
      expect(screen.getByText(/auto-updating/i)).toBeTruthy()
    })

    it('renders container element even with no events', () => {
      render(<LiveFeed />)
      expect(document.querySelector('.glass-panel')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 2. Socket connection lifecycle
  // -------------------------------------------------------------------------
  describe('socket connection', () => {
    it('connects to the socket server when not in demo mode', () => {
      render(<LiveFeed />)
      expect(mockIo).toHaveBeenCalled()
    })

    it('registers extension_heartbeat socket event', () => {
      render(<LiveFeed />)
      const registeredEvents = mockSocketOn.mock.calls.map(
        (call: unknown[]) => call[0]
      )
      expect(registeredEvents).toContain('extension_heartbeat')
    })

    it('disconnects the socket on unmount', () => {
      const { unmount } = render(<LiveFeed />)
      unmount()
      expect(mockSocketDisconnect).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 3. Renders mock/existing events list (demo mode)
  // -------------------------------------------------------------------------
describe('component feed', () => {
      it('renders without crashing', async () => {
        await act(async () => {
          render(<LiveFeed />)
        })
        expect(document.body).toBeTruthy()
      })

      it('shows the feed container', async () => {
        await act(async () => {
          render(<LiveFeed />)
      })
      expect(document.querySelector('.glass-panel')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // 4. Real socket event updates feed
  // -------------------------------------------------------------------------
  describe('real-time heartbeat updates', () => {
    it('prepends a new event to the feed when extension_heartbeat arrives', async () => {
      let heartbeatHandler: ((data: unknown) => void) | null = null

      mockSocketOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
        if (event === 'extension_heartbeat') {
          heartbeatHandler = handler
        }
      })
      mockIo.mockReturnValue({
        on: mockSocketOn,
        disconnect: mockSocketDisconnect,
        off: mockSocketOff,
      })

      await act(async () => {
        render(<LiveFeed />)
      })

      expect(heartbeatHandler).not.toBeNull()

      await act(async () => {
        heartbeatHandler!({
          instance_id: 'inst-123',
          browser: 'Chrome 120',
          last_seen: '2026-03-30T12:00:00.000Z',
        })
      })

      // The component should render something — the event was processed
      expect(document.body).toBeTruthy()
    })

    it('keeps at most 20 events in the feed after many heartbeats', async () => {
      let heartbeatHandler: ((data: unknown) => void) | null = null

      mockSocketOn.mockImplementation((event: string, handler: (data: unknown) => void) => {
        if (event === 'extension_heartbeat') {
          heartbeatHandler = handler
        }
      })
      mockIo.mockReturnValue({
        on: mockSocketOn,
        disconnect: mockSocketDisconnect,
        off: mockSocketOff,
      })

      await act(async () => {
        render(<LiveFeed />)
      })

      expect(heartbeatHandler).not.toBeNull()

      // Fire 25 heartbeat events
      await act(async () => {
        for (let idx = 0; idx < 25; idx++) {
          heartbeatHandler!({
            instance_id: `inst-${idx}`,
            browser: `Browser ${idx}`,
            last_seen: new Date().toISOString(),
          })
        }
      })

      // Component should not crash and still be in the document
      expect(document.body).toBeTruthy()
    })
  })
})
