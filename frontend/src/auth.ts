import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

import { loginWithBackend, loginWithToken } from "./lib/auth-api";

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

        return null;
      }
    })
  ]
});
