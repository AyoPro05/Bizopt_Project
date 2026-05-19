import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname === "/dashboard" || req.nextUrl.pathname.startsWith("/dashboard/")) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } }
);

export const config = {
  matcher: [
    "/home/:path*",
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/calendar/:path*",
    "/assets/:path*",
    "/ai-studio/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/devices/:path*",
    "/integrations/:path*",
  ],
};
