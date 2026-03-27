
import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string;
    fromDemo?: boolean;
    fromBackend?: boolean;
    accessToken?: string;
  }
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      role?: string;
      fromDemo?: boolean;
      fromBackend?: boolean;
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    role?: string;
    fromBackend?: boolean;
    fromDemo?: boolean;
    id?: string;
  }
}
