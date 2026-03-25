import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnAdmin = nextUrl.pathname.startsWith('/dashboard/admin');

      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect to login
        if (isOnAdmin && auth.user.role !== 'admin') {
          return Response.redirect(new URL('/dashboard/user', nextUrl));
        }
        return true;
      } else if (isLoggedIn && nextUrl.pathname === '/login') {
        const redirectUrl = auth.user.role === 'admin' ? '/dashboard/admin' : '/dashboard/user';
        return Response.redirect(new URL(redirectUrl, nextUrl));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
      }
      if (trigger === "update" && session?.role) {
        token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  providers: [], // configured in auth.ts
} satisfies NextAuthConfig;
