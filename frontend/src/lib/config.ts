export const config = {
  API: {
    BASE_URL: process.env.API_URL || 'http://localhost:5000',
    AUTH: {
      LOGIN: '/api/auth/login',
      SIGNUP: '/api/auth/signup',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
      VERIFY_EMAIL: '/api/auth/verify-email',
      AUTH_URL: '/api/auth/url',
      GRANT_EMAIL_ACCESS: '/api/auth/grant-email-access',
    }
  },
  ROUTES: {
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    DASHBOARD_ADMIN: '/dashboard/admin',
    DASHBOARD_USER: '/dashboard/user',
    DASHBOARD_ADMIN_ROUNDS: '/dashboard/admin/rounds',
    DASHBOARD_USER_ROUNDS: '/dashboard/user/rounds',
  },
  STORAGE_KEYS: {
    PENDING_SIGNUP: 'sentra-pending-signup',
    IS_DEMO: 'is-demo',
  },
  DEMO_ACCOUNTS: {
    ADMIN: { 
      email: process.env.DEMO_ADMIN_EMAIL || 'test-admin', 
      password: process.env.DEMO_ADMIN_PASSWORD || 'test-admin' 
    },
    USER: { 
      email: process.env.DEMO_USER_EMAIL || 'test-user', 
      password: process.env.DEMO_USER_PASSWORD || 'test-user' 
    },
  }
};
