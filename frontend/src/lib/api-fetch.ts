/**
 * Shared fetch wrapper that centralises 401/429 error handling.
 *
 * - 401 Unauthorized → signs the user out and redirects to the login page with
 *   ?expired=1 so the login page can display an appropriate banner.
 * - 429 Too Many Requests → shows a rate-limit toast.
 * - All other errors are re-thrown for callers to handle.
 */

import { toast } from "sonner";

let _signOutFn: ((opts: { callbackUrl: string }) => Promise<void>) | null = null;

/**
 * Register the NextAuth signOut function.
 * Call this once from a client component at app startup (e.g. a layout provider).
 */
export function registerSignOut(fn: (opts: { callbackUrl: string }) => Promise<void>) {
  _signOutFn = fn;
}

export async function apiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(url, init);

  if (res.status === 401) {
    toast.error("Your session has expired. Please sign in again.", {
      id: "session-expired",
      duration: 5000,
    });
    if (_signOutFn) {
      await _signOutFn({ callbackUrl: "/login?expired=1" });
    } else {
      // Fallback: hard redirect if signOut hasn't been registered yet
      window.location.href = "/login?expired=1";
    }
    // Return the response so callers can bail out without throwing
    return res;
  }

  if (res.status === 429) {
    toast.warning("Too many requests. Please wait a moment before trying again.", {
      id: "rate-limited",
      duration: 5000,
    });
    return res;
  }

  return res;
}
