import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { MOCK_USERS } from "./lib/mock-data";

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Role Toggle",
      credentials: {
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.role) return null;
        const role = credentials.role as string;
        
        const user = MOCK_USERS.find(u => u.role === role);
        if (user) {
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }
        return null;
      }
    })
  ]
});
