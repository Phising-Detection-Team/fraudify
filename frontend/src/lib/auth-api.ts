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
 * Call backend login endpoint
 * @param email User email
 * @param password User password
 * @returns User data if successful, null if failed or backend unavailable
 */
export async function loginWithBackend(email: string, password: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      console.error(`Login failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: AuthResponse = await response.json();
    return {
      user: data.user,
      accessToken: data.access_token,
    };
  } catch (error) {
    console.error('Backend login error:', error);
    return null;
  }
}

/**
 * Call backend signup endpoint
 * @param email User email
 * @param password User password
 * @returns User data if successful, null if failed or backend unavailable
 */
export async function signupWithBackend(email: string, password: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}${config.API.AUTH.SIGNUP}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`Signup failed: ${error.error || response.statusText}`);
      return null;
    }

    const data: AuthResponse = await response.json();
    return data.user;
  } catch (error) {
    console.error('Backend signup error:', error);
    return null;
  }
}

/**
 * Get all users (admin only)
 * @param accessToken Bearer token for admin authorization
 * @returns Array of users if successful, null if failed
 */
export async function getAllUsers(accessToken: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
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
 * Check if a user is admin
 * @param userId UUID of user to check
 * @returns Object with is_admin status, null if failed
 */
export async function checkUserAdminStatus(userId: string) {
  try {
    const response = await fetch(`${config.API.BASE_URL}/api/users/${userId}/admin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
