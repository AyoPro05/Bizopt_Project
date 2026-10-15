import "next-auth";

declare module "next-auth" {
  interface Session {
    sessionId?: string | null;
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sid?: string;
    sv?: number;
  }
}
