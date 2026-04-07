/**
 * Authentication API utilities
 * Handles communication with backend authentication endpoints
 */

import { config } from "./config";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    email: string;
    username: string;
    is_active: boolean;
    email_verified: boolean;
    roles: string[];
    created_at: string;
    updated_at: string;
  };
}

/**
 * Call backend login endpoint.
 * Returns user+accessToken on success, null on any failure.
 * Used by NextAuth's authorize() — must return null (not an error object) on failure.
 */
export async function loginWithBackend(email: string, password: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) return null;

    const data: AuthResponse = await response.json();
    return {
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    console.error('Backend login error:', error);
    return null;
  }
}

/**
 * Exchange a verification token for a user + access token.
 * Used by NextAuth authorize() to establish a session after email verification.
 */
export async function loginWithToken(token: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.VERIFY_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) return null;

    const data: AuthResponse = await response.json();
    return { user: data.user, accessToken: data.access_token };
  } catch (error) {
    console.error('Backend token login error:', error);
    return null;
  }
}

/**
 * Check login status and return the full backend response.
 * Used by the login page to detect specific errors like "Email not verified".
 */
export async function checkLoginStatus(
  email: string,
  password: string,
): Promise<{ ok: boolean; status: number; error?: string; message?: string; user?: { roles: string[] } }> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, error: data.error, message: data.message, user: data.user };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}

/**
 * Call backend signup endpoint. Does NOT return JWT — verification is required next.
 */
export async function signupWithBackend(email: string, password: string, name?: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.SIGNUP}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || null }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Signup failed', message: data.message, status: response.status };
    }
    return { success: true, userId: data.user_id, email: data.email };
  } catch (error) {
    console.error('Backend signup error:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Send (or resend) a verification email to the given address.
 */
export async function sendVerificationEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.SEND_VERIFICATION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Failed to send verification email' };
    return { success: true };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify email with a 6-digit code entered by the user.
 * Returns AuthResponse on success (contains JWT tokens).
 */
export async function verifyEmailWithCode(
  email: string,
  code: string,
): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.VERIFY_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Verification failed' };
    return { success: true, data };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify email using the token from the link in the verification email.
 * Returns AuthResponse on success (contains JWT tokens).
 */
export async function verifyEmailWithToken(
  token: string,
): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.VERIFY_EMAIL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error || 'Verification failed' };
    return { success: true, data };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(accessToken: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Get users failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.users;
  } catch (error) {
    console.error('Get users error:', error);
    return null;
  }
}

/**
 * Request a password reset email
 * @param email User email address
 * @returns true if request was accepted (including when email doesn't exist — no enumeration)
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.FORGOT_PASSWORD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Reset a user's password using a reset token
 * @param token Reset token from the password reset email
 * @param newPassword New password to set
 * @returns true on success, false on failure (expired/invalid token)
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.RESET_PASSWORD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a user is admin
 */
export async function checkUserAdminStatus(userId: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}/api/users/${userId}/admin`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`Check admin status failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return { userId: data.user_id, email: data.email, isAdmin: data.is_admin };
  } catch (error) {
    console.error('Check admin status error:', error);
    return null;
  }
}
