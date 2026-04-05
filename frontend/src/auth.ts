import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { config } from "./lib/config";
import { loginWithBackend, loginWithToken } from "./lib/auth-api";

/**
 * Authenticate with demo/mock accounts
 * Used for presentations and testing without backend
 */
function authenticateWithDemo(email: string, password: string) {
  // Check Demo Admin
  if (email === config.DEMO_ACCOUNTS.ADMIN.email && password === config.DEMO_ACCOUNTS.ADMIN.password) {
    return {
      id: "demo-admin",
      name: "Demo Admin",
      email: email,
      role: "admin",
      isAdmin: true,
      isActive: true,
      fromDemo: true,
    };
  }

  // Check Demo User
  if (email === config.DEMO_ACCOUNTS.USER.email && password === config.DEMO_ACCOUNTS.USER.password) {
    return {
      id: "demo-user",
      name: "Demo User",
      email: email,
      role: "user",
      isAdmin: false,
      isActive: true,
      fromDemo: true,
    };
  }

  return null;
}

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        // Token-based flow (used for verification links)
        if (credentials?.token) {
          const token = credentials.token as string;
          const backendResult = await loginWithToken(token);
          if (backendResult) {
            const { user: backendUser, accessToken } = backendResult;
            return {
              id: String(backendUser.id),
              name: backendUser.username,
              email: backendUser.email,
              role: backendUser.roles.includes('admin') ? 'admin' : 'user',
              isAdmin: backendUser.roles.includes('admin'),
              isActive: backendUser.is_active,
              fromBackend: true,
              accessToken,
            };
          }
          return null;
        }

        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // First, try to authenticate with real backend
        const backendResult = await loginWithBackend(email, password);
        if (backendResult) {
          const { user: backendUser, accessToken, refreshToken } = backendResult;
          return {
            id: String(backendUser.id),
            name: backendUser.username,
            email: backendUser.email,
            role: backendUser.roles.includes('admin') ? 'admin' : 'user',
            isAdmin: backendUser.roles.includes('admin'),
            isActive: backendUser.is_active,
            fromBackend: true,
            accessToken,
            refreshToken,
          };
        }

        // Fallback to demo/mock accounts only when explicitly enabled
        if (process.env.DEMO_MODE === 'true') {
          const demoUser = authenticateWithDemo(email, password);
          if (demoUser) return demoUser;
        }

        return null;
      }
    })
  ]
});
