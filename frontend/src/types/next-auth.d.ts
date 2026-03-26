
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    fromDemo?: boolean;
    fromBackend?: boolean;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      fromDemo?: boolean;
      fromBackend?: boolean;
    } & DefaultSession["user"]
  }
}
