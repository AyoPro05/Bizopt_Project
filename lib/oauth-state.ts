import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  orgId: string;
  userId: string;
  platform: string;
  exp: number;
};

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET must be set for OAuth state");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createOAuthState(payload: Omit<OAuthStatePayload, "exp">): string {
  const full: OAuthStatePayload = { ...payload, exp: Date.now() + TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyOAuthState(token: string | null): OAuthStatePayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    if (payload.exp < Date.now()) return null;
    if (!payload.orgId || !payload.userId || !payload.platform) return null;
    return payload;
  } catch {
    return null;
  }
}
