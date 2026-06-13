import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
  message: string;
};

function getApiRateLimitRule(pathname: string): RateLimitRule {
  const isAuthRoute =
    pathname === "/api/auth/signup" ||
    pathname === "/api/auth/mobile/login" ||
    pathname === "/api/auth/signin" ||
    pathname.startsWith("/api/auth/callback/") ||
    pathname.includes("password-reset");

  if (isAuthRoute) {
    return {
      key: "auth-sensitive",
      limit: 10,
      windowMs: 60_000,
      message: "Too many authentication attempts. Please wait a minute and try again.",
    };
  }

  const isPaidApi =
    pathname === "/api/ai/generate" ||
    pathname.startsWith("/api/stripe/") ||
    pathname === "/api/publish/schedule";

  if (isPaidApi) {
    return {
      key: "paid-api",
      limit: 20,
      windowMs: 60_000,
      message: "Too many requests to a protected endpoint. Please wait and retry.",
    };
  }

  return {
    key: "default-api",
    limit: 60,
    windowMs: 60_000,
    message: "Rate limit exceeded. Please wait and try again.",
  };
}

function applyApiRateLimit(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const rule = getApiRateLimitRule(pathname);
  const ip = clientIp(req);
  const bucketKey = `mw:${rule.key}:${pathname}:${ip}`;
  const limited = rateLimit(bucketKey, rule.limit, rule.windowMs);

  if (limited.ok) return null;

  return NextResponse.json(
    {
      error: rule.message,
      retryAfterSec: limited.retryAfterSec ?? 60,
      limit: rule.limit,
      windowMs: rule.windowMs,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(limited.retryAfterSec ?? 60),
      },
    }
  );
}

export default withAuth(
  function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      const response = applyApiRateLimit(req);
      if (response) return response;
      return NextResponse.next();
    }

    if (req.nextUrl.pathname === "/dashboard" || req.nextUrl.pathname.startsWith("/dashboard/")) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ req, token }) => {
        if (req.nextUrl.pathname.startsWith("/api/")) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/api/:path*",
    "/home/:path*",
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/calendar/:path*",
    "/assets/:path*",
    "/ai-studio/:path*",
    "/analytics/:path*",
    "/growth-intelligence/:path*",
    "/compliance-center/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/devices/:path*",
    "/integrations/:path*",
  ],
};
