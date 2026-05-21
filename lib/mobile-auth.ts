import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.MOBILE_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("MOBILE_JWT_SECRET or NEXTAUTH_SECRET required");
  return s;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function signJwt(payload: Record<string, unknown>, ttlSec: number): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + ttlSec })
  );
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function signAccessToken(userId: string): string {
  return signJwt({ sub: userId, typ: "access" }, ACCESS_TTL_SEC);
}

export function verifyAccessToken(
  token: string
): { userId: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = `${header}.${body}`;
    const expected = createHmac("sha256", secret())
      .update(data)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { sub?: string; typ?: string; exp?: number };

    if (payload.typ !== "access" || !payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

function hashRefreshToken(raw: string): string {
  return createHmac("sha256", secret()).update(raw).digest("hex");
}

export async function authenticateCredentials(
  email: string,
  password: string
): Promise<{ userId: string } | null> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user?.passwordHash) return null;
  const valid = await compare(password, user.passwordHash);
  if (!valid) return null;
  return { userId: user.id };
}

export async function createMobileSession(
  userId: string,
  deviceLabel?: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshToken = randomBytes(32).toString("base64url");
  const refreshHash = hashRefreshToken(refreshToken);

  await db.mobileSession.create({
    data: {
      userId,
      refreshHash,
      deviceLabel,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return {
    accessToken: signAccessToken(userId),
    refreshToken,
    expiresIn: ACCESS_TTL_SEC,
  };
}

export async function refreshMobileSession(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const refreshHash = hashRefreshToken(refreshToken);
  const session = await db.mobileSession.findUnique({
    where: { refreshHash },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  await db.mobileSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  const accessToken = signAccessToken(session.userId);
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SEC,
  };
}

export async function revokeMobileSession(refreshToken: string): Promise<boolean> {
  const refreshHash = hashRefreshToken(refreshToken);
  const result = await db.mobileSession.updateMany({
    where: { refreshHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
