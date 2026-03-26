import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { config } from "./lib/config";
import { loginWithBackend } from "./lib/auth-api";

/**
 * Authenticate with demo/mock accounts
 * Used for presentations and testing without backend
 */
function authenticateWithDemo(email: string, password: string) {
  console.log("Attempting demo authentication...");
  
  // Check Demo Admin
  if (email === config.DEMO_ACCOUNTS.ADMIN.email && password === config.DEMO_ACCOUNTS.ADMIN.password) {
    console.log("✓ Demo admin authentication successful");
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
    console.log("✓ Demo user authentication successful");
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
      },
      async authorize(credentials) {
        console.log("Authorization initiated...");
        if (!credentials?.email || !credentials?.password) return null;

        const { email, password } = credentials;

        // First, try to authenticate with real backend
        console.log("Attempting backend authentication...");
        const backendUser = await loginWithBackend(email, password);
        if (backendUser) {
          console.log("✓ Backend authentication successful");
          return {
            id: backendUser.id,
            name: backendUser.email,
            email: backendUser.email,
            role: backendUser.is_admin ? 'admin' : 'user',
            isAdmin: backendUser.is_admin,
            isActive: backendUser.is_active,
            fromBackend: true,
          };
        }

        // Fallback to demo/mock accounts for presentations and testing
        // This allows the app to work in offline mode or for demo purposes
        const demoUser = authenticateWithDemo(email, password);
        if (demoUser) {
          console.log("⚠️  Using demo authentication (backend not available or no match)");
          return demoUser;
        }

        console.log("Authentication failed: no match found");
        return null;
      }
    })
  ]
});
