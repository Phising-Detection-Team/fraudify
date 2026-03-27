import type { NextAuthConfig } from "next-auth";
import { config } from "./lib/config";

export const authConfig = {
  pages: {
    signIn: config.ROUTES.LOGIN,
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnAdmin = nextUrl.pathname.startsWith(config.ROUTES.DASHBOARD_ADMIN);
      const isOnLogin = nextUrl.pathname === config.ROUTES.LOGIN;

      // If on dashboard, require login
      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect to login (NextAuth handles this)
        if (isOnAdmin && auth.user.role !== 'admin') {
          // Redirect non-admin users away from admin routes to their own dashboard
          return Response.redirect(new URL(config.ROUTES.DASHBOARD_USER, nextUrl));
        }
        return true; // Allow access
      }
      
      // If logged in and on login page, allow it (frontend will redirect to dashboard)
      if (isLoggedIn && isOnLogin) {
        return true; // Allow page to load, frontend redirect will happen
      }
      
      // Allow all other routes
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.fromBackend = user.fromBackend;
        token.fromDemo = user.fromDemo;
        token.id = user.id;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.fromBackend = token.fromBackend as boolean;
        session.user.fromDemo = token.fromDemo as boolean;
        session.user.id = token.id as string;
      }
      session.accessToken = token.accessToken as string | undefined;
      return session;
    }
  },
  providers: [], // configured in auth.ts
} satisfies NextAuthConfig;
