import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExtensionInstances,
  getAllExtensionInstances,
  deleteExtensionInstance,
  getUsers,
  updatePassword,
  overrideEmailVerdict,
} from '../admin-api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    })
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// getExtensionInstances
// ---------------------------------------------------------------------------

describe('getExtensionInstances', () => {
  it('returns the data array', async () => {
    const fakeInstances = [
      { id: 1, user_id: 10, instance_token: 'abc', is_active: true },
      { id: 2, user_id: 10, instance_token: 'def', is_active: false },
    ]
    mockFetch({ success: true, data: fakeInstances })

    const result = await getExtensionInstances('token')
    expect(result).toHaveLength(2)
    expect(result[0].instance_token).toBe('abc')
  })

  it('returns empty array when data is missing', async () => {
    mockFetch({ success: true })
    const result = await getExtensionInstances('token')
    expect(result).toEqual([])
  })

  it('throws on non-ok response', async () => {
    mockFetch({ error: 'Unauthorized' }, false, 401)
    await expect(getExtensionInstances('bad')).rejects.toThrow(
      'Failed to fetch extension instances'
    )
  })
})

// ---------------------------------------------------------------------------
// getAllExtensionInstances
// ---------------------------------------------------------------------------

describe('getAllExtensionInstances', () => {
  it('returns data, total, and active fields', async () => {
    const fakeInstances = [
      { id: 1, user_id: 1, instance_token: 'aaa', is_active: true, user: { email: 'a@b.com' } },
    ]
    mockFetch({ success: true, data: fakeInstances, total: 1, active: 1 })

    const result = await getAllExtensionInstances('token')
    expect(result.total).toBe(1)
    expect(result.active).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].user?.email).toBe('a@b.com')
  })

  it('defaults total and active to zero when missing', async () => {
    mockFetch({ success: true, data: [] })
    const result = await getAllExtensionInstances('token')
    expect(result.total).toBe(0)
    expect(result.active).toBe(0)
  })

  it('throws on non-ok response', async () => {
    mockFetch({ error: 'Forbidden' }, false, 403)
    await expect(getAllExtensionInstances('user-token')).rejects.toThrow(
      'Failed to fetch all extension instances'
    )
  })
})

// ---------------------------------------------------------------------------
// deleteExtensionInstance
// ---------------------------------------------------------------------------

describe('deleteExtensionInstance', () => {
  it('DELETEs the correct instance endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await deleteExtensionInstance('token', 42)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/extension/instances/42')
    expect(init.method).toBe('DELETE')
  })

  it('resolves without error on success', async () => {
    mockFetch({ success: true }, true, 200)
    await expect(deleteExtensionInstance('token', 1)).resolves.toBeUndefined()
  })

  it('throws with the server error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Instance not found' }),
      })
    )
    await expect(deleteExtensionInstance('token', 99)).rejects.toThrow('Instance not found')
  })
})

// ---------------------------------------------------------------------------
// getUsers
// ---------------------------------------------------------------------------

describe('getUsers', () => {
  it('returns the items array from the response', async () => {
    const fakeUsers = [
      { id: 1, email: 'admin@x.com', username: 'admin', roles: ['admin'], is_active: true },
      { id: 2, email: 'user@x.com', username: 'user', roles: ['user'], is_active: true },
    ]
    mockFetch({ success: true, items: fakeUsers })

    const users = await getUsers('admin-token')
    expect(users).toHaveLength(2)
    expect(users[0].email).toBe('admin@x.com')
  })

  it('falls back to "data" key when "items" is absent', async () => {
    const fakeUsers = [{ id: 3, email: 'c@x.com', username: 'c', roles: [], is_active: false }]
    mockFetch({ success: true, data: fakeUsers })

    const users = await getUsers('admin-token')
    expect(users[0].email).toBe('c@x.com')
  })

  it('returns empty array when neither key exists', async () => {
    mockFetch({ success: true })
    expect(await getUsers('admin-token')).toEqual([])
  })

  it('throws on non-ok response', async () => {
    mockFetch({ error: 'Forbidden' }, false, 403)
    await expect(getUsers('user-token')).rejects.toThrow('Failed to fetch users')
  })
})

// ---------------------------------------------------------------------------
// updatePassword
// ---------------------------------------------------------------------------

describe('updatePassword', () => {
  it('resolves without error on success', async () => {
    mockFetch({ success: true })
    await expect(updatePassword('token', 'OldPass1', 'NewPass9')).resolves.toBeUndefined()
  })

  it('sends current_password and new_password in body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await updatePassword('token', 'OldPass1', 'NewPass9')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.current_password).toBe('OldPass1')
    expect(body.new_password).toBe('NewPass9')
  })

  it('throws with the server error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Wrong current password' }),
      })
    )
    await expect(updatePassword('token', 'WrongPass1', 'NewPass9')).rejects.toThrow(
      'Wrong current password'
    )
  })

  it('throws with fallback message when server returns no error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
    )
    await expect(updatePassword('token', 'OldPass1', 'NewPass9')).rejects.toThrow(
      'Failed to update password'
    )
  })
})

// ---------------------------------------------------------------------------
// overrideEmailVerdict
// ---------------------------------------------------------------------------

describe('overrideEmailVerdict', () => {
  it('returns the override data on success', async () => {
    const fakeOverride = {
      id: 1,
      email_id: 42,
      verdict: 'legitimate',
      reason: 'False positive — internal newsletter',
      overridden_by: 5,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: fakeOverride }),
      })
    )

    const result = await overrideEmailVerdict('admin-token', 42, 'legitimate', 'False positive — internal newsletter')
    expect(result).toMatchObject({ verdict: 'legitimate', email_id: 42 })
  })

  it('POSTs to /api/emails/<id>/override with correct body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 1 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await overrideEmailVerdict('admin-token', 99, 'phishing', 'Confirmed phishing')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/emails/99/override')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.verdict).toBe('phishing')
    expect(body.reason).toBe('Confirmed phishing')
  })

  it('sends Authorization header with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 1 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await overrideEmailVerdict('my-admin-token', 10, 'legitimate')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-admin-token')
  })

  it('works without an optional reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { id: 1, verdict: 'legitimate' } }),
      })
    )

    const result = await overrideEmailVerdict('token', 5, 'legitimate')
    expect(result).toBeDefined()
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Email already has an override' }),
      })
    )

    await expect(overrideEmailVerdict('token', 7, 'legitimate')).rejects.toThrow(
      'Email already has an override'
    )
  })
})
