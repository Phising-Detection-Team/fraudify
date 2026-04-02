import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock next-auth
// ---------------------------------------------------------------------------
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock lucide-react
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  Eye:          () => <svg data-testid="eye-icon" />,
  EyeOff:       () => <svg data-testid="eyeoff-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
  AlertCircle:  () => <svg data-testid="alert-circle-icon" />,
  Loader2:      () => <svg data-testid="loader-icon" />,
  Puzzle:       () => <svg data-testid="puzzle-icon" />,
  Copy:         () => <svg data-testid="copy-icon" />,
  Check:        () => <svg data-testid="check-icon" />,
  Wifi:         () => <svg data-testid="wifi-icon" />,
  WifiOff:      () => <svg data-testid="wifioff-icon" />,
  Trash2:       () => <svg data-testid="trash-icon" />,
  Plus:         () => <svg data-testid="plus-icon" />,
}))

// ---------------------------------------------------------------------------
// Mock admin-api
// ---------------------------------------------------------------------------
vi.mock('@/lib/admin-api', () => ({
  getMe: vi.fn(),
  updatePassword: vi.fn(),
  getExtensionInstances: vi.fn(),
  deleteExtensionInstance: vi.fn(),
}))

import { useSession } from 'next-auth/react'
import { getMe, getExtensionInstances, deleteExtensionInstance } from '@/lib/admin-api'
import type { ExtensionInstance, BackendUser } from '@/lib/admin-api'
import { ProfileSettings } from '@/components/ProfileSettings'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSession = {
  data: {
    accessToken: 'test-token',
    user: {
      fromBackend: true,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
    },
  },
  status: 'authenticated',
}

const mockProfile: BackendUser = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  roles: ['user'],
  created_at: '2025-01-01T00:00:00Z',
  is_active: true,
}

function makeInstance(overrides: Partial<ExtensionInstance> = {}): ExtensionInstance {
  return {
    id: 1,
    user_id: 1,
    instance_token: 'tok-abc123',
    browser: 'Chrome 124',
    os_name: 'Windows 11',
    last_seen: '2025-03-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    is_active: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue(mockSession as ReturnType<typeof useSession>)
    vi.mocked(getMe).mockResolvedValue(mockProfile)
    vi.mocked(getExtensionInstances).mockResolvedValue([])
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // No "Add Instance" button
  // -------------------------------------------------------------------------

  describe('Add Instance button is gone', () => {
    it('does not render any button with "Add Instance" text', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        expect(screen.queryByText(/add instance/i)).toBeNull()
      })
    })

    it('does not render the plus icon', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        expect(screen.queryByTestId('plus-icon')).toBeNull()
      })
    })
  })

  // -------------------------------------------------------------------------
  // HOW IT WORKS — auto-connect steps
  // -------------------------------------------------------------------------

  describe('HOW IT WORKS instructions', () => {
    it('shows step about installing the browser extension', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        expect(screen.getByText(/install the sentra browser extension/i)).toBeTruthy()
      })
    })

    it('shows step about logging in to the Sentra dashboard', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        expect(screen.getByText(/log in to the sentra dashboard/i)).toBeTruthy()
      })
    })

    it('shows step about automatic connection', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        expect(screen.getByText(/automatically connects/i)).toBeTruthy()
      })
    })

    it('renders exactly 3 HOW IT WORKS steps', async () => {
      await act(async () => { render(<ProfileSettings />) })
      await waitFor(() => {
        // Find numbered step badges (1, 2, 3) — the component uses rounded spans with step numbers
        const stepBadges = screen.getAllByText(/^[123]$/)
        expect(stepBadges.length).toBe(3)
      })
    })
  })

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows "Install the extension" message when no instances', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        expect(screen.getByText(/no instances registered yet/i)).toBeTruthy()
      })
    })

    it('empty state tells user to install extension and log in', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        const text = document.body.textContent ?? ''
        expect(text).toMatch(/install the extension and log in/i)
      })
    })

    it('does not show "Add Instance" in empty state', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        expect(screen.queryByText(/add instance/i)).toBeNull()
      })
    })
  })

  // -------------------------------------------------------------------------
  // Remove button per instance
  // -------------------------------------------------------------------------

  describe('remove button', () => {
    it('renders a remove button for each instance', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([
        makeInstance({ id: 1 }),
        makeInstance({ id: 2, instance_token: 'tok-xyz' }),
      ])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        expect(screen.getByTestId('remove-instance-1')).toBeTruthy()
        expect(screen.getByTestId('remove-instance-2')).toBeTruthy()
      })
    })

    it('each remove button shows a trash icon', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 5 })])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        const removeBtn = screen.getByTestId('remove-instance-5')
        expect(removeBtn.querySelector('[data-testid="trash-icon"]')).toBeTruthy()
      })
    })
  })

  // -------------------------------------------------------------------------
  // Clicking remove calls deleteExtensionInstance
  // -------------------------------------------------------------------------

  describe('remove action', () => {
    it('calls deleteExtensionInstance with correct instanceId on click', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 7 })])
      vi.mocked(deleteExtensionInstance).mockResolvedValue(undefined)

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-7')).toBeTruthy())

      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-instance-7'))
      })

      await waitFor(() => {
        expect(vi.mocked(deleteExtensionInstance)).toHaveBeenCalledWith('test-token', 7)
      })
    })

    it('removes the instance from the list after successful delete', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 9 })])
      vi.mocked(deleteExtensionInstance).mockResolvedValue(undefined)

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-9')).toBeTruthy())

      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-instance-9'))
      })

      await waitFor(() => {
        expect(screen.queryByTestId('remove-instance-9')).toBeNull()
      })
    })

    it('keeps other instances when one is removed', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([
        makeInstance({ id: 10 }),
        makeInstance({ id: 11, instance_token: 'tok-other' }),
      ])
      vi.mocked(deleteExtensionInstance).mockResolvedValue(undefined)

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-10')).toBeTruthy())

      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-instance-10'))
      })

      await waitFor(() => {
        expect(screen.queryByTestId('remove-instance-10')).toBeNull()
        expect(screen.getByTestId('remove-instance-11')).toBeTruthy()
      })
    })

    it('shows spinner while deletion is in progress', async () => {
      let resolveDelete!: () => void
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 3 })])
      vi.mocked(deleteExtensionInstance).mockReturnValue(
        new Promise<void>((resolve) => { resolveDelete = resolve })
      )

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-3')).toBeTruthy())

      act(() => {
        fireEvent.click(screen.getByTestId('remove-instance-3'))
      })

      await waitFor(() => {
        const btn = screen.getByTestId('remove-instance-3')
        expect(btn.querySelector('[data-testid="loader-icon"]')).toBeTruthy()
      })

      await act(async () => { resolveDelete() })
    })

    it('shows error message when deletion fails', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 4 })])
      vi.mocked(deleteExtensionInstance).mockRejectedValue(new Error('Server error'))

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-4')).toBeTruthy())

      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-instance-4'))
      })

      await waitFor(() => {
        const body = document.body.textContent ?? ''
        expect(body).toMatch(/server error/i)
      })
    })

    it('keeps instance in list when deletion fails', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([makeInstance({ id: 6 })])
      vi.mocked(deleteExtensionInstance).mockRejectedValue(new Error('Failed'))

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => expect(screen.getByTestId('remove-instance-6')).toBeTruthy())

      await act(async () => {
        fireEvent.click(screen.getByTestId('remove-instance-6'))
      })

      await waitFor(() => {
        const body = document.body.textContent ?? ''
        expect(body).toMatch(/failed/i)
      })

      expect(screen.getByTestId('remove-instance-6')).toBeTruthy()
    })
  })

  // -------------------------------------------------------------------------
  // "No heartbeat" per-instance text
  // -------------------------------------------------------------------------

  describe('instance no-heartbeat message', () => {
    it('shows correct no-heartbeat message for instance with null last_seen', async () => {
      vi.mocked(getExtensionInstances).mockResolvedValue([
        makeInstance({ id: 20, last_seen: null }),
      ])

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        const body = document.body.textContent ?? ''
        expect(body).toMatch(/no heartbeat received yet/i)
        expect(body).toMatch(/check the extension is installed/i)
      })
    })
  })

  // -------------------------------------------------------------------------
  // Non-backend session — extension tracking unavailable
  // -------------------------------------------------------------------------

  describe('non-backend session', () => {
    it('shows unavailable message instead of instances for non-backend accounts', async () => {
      vi.mocked(useSession).mockReturnValue({
        data: {
          accessToken: 'sso-token',
          user: { fromBackend: false, name: 'SSO User', email: 'sso@example.com', role: 'user' },
        },
        status: 'authenticated',
      } as ReturnType<typeof useSession>)

      await act(async () => { render(<ProfileSettings />) })

      await waitFor(() => {
        const body = document.body.textContent ?? ''
        expect(body).toMatch(/extension tracking is only available for backend accounts/i)
      })
    })
  })
})
