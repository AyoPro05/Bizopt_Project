import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

export const AUDIT_USER_AGENT = "BizOptzSEO/1.0";
const MAX_BYTES = 1_048_576;

export type SafeResponse = {
  url: string;
  status: number;
  body: string;
  headers: Record<string, string>;
};

/** Conservative public-only policy: special-use and transition ranges are excluded. */
export function isPublicAddress(input: string): boolean {
  const ip = input.replace(/^\[|\]$/g, "");
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(ip) !== 6 || ip.includes("%")) return false;
  // Only global unicast 2000::/3; this also rejects IPv4-mapped addresses.
  const groups = ip.toLowerCase().split(":");
  const first = parseInt(groups[0], 16);
  const second = parseInt(groups[1] || "0", 16);
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) &&
    first !== 0x2002 && !(first === 0x3fff && second <= 0xfff);
}

export function validateAuditUrl(input: string): URL {
  if (input.length > 4_096) throw new Error("Audit URL is too long.");
  const url = new URL(input);
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password) {
    throw new Error("Audit URLs must use HTTPS on port 443 without credentials.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".test") ||
    (!hostname.includes(".") && !isIP(hostname)) || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new Error("Audit target must have a public Internet address.");
  }
  url.hash = "";
  return url;
}

export function withinScope(url: URL, scope: URL): boolean {
  // Avoid differing proxy/server interpretations of encoded separators or double encoding.
  if (/%(?:2f|5c|25)/i.test(url.pathname)) return false;
  const prefix = scope.pathname.replace(/\/+$/, "");
  return url.origin === scope.origin && (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
}

type SafeFetchOptions = {
  deadline?: number;
  scope?: URL;
  canRequest?: (url: URL) => boolean;
};

/** GET only, no cookies, no pooled connections, one vetted DNS lookup per hop. */
export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const deadline = options.deadline ?? Date.now() + 8_000;
  let next = input;
  for (let hop = 0; hop <= 4; hop++) {
    const url = validateAuditUrl(next);
    if ((options.scope && !withinScope(url, options.scope)) || (options.canRequest && !options.canRequest(url))) {
      throw new Error("Request is outside the authorised crawl scope or robots policy.");
    }
    const remaining = Math.min(8_000, deadline - Date.now());
    if (remaining <= 0) throw new Error("Audit request deadline exceeded.");
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    // DNS is included in the request deadline; a late DNS result cannot initiate a request.
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      isIP(hostname) ? Promise.resolve([{ address: hostname, family: isIP(hostname) }]) : lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("DNS lookup timed out.")), remaining); }),
    ]).finally(() => clearTimeout(dnsTimer));
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new Error("DNS must resolve exclusively to public Internet addresses.");
    }
    const pinned = addresses[0];
    const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) callback(null, [{ address: pinned.address, family: pinned.family }]);
      else callback(null, pinned.address, pinned.family);
    };
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    const response = await new Promise<SafeResponse>((resolve, reject) => {
      const duration = Math.min(8_000, deadline - Date.now());
      if (duration <= 0) { reject(new Error("Audit request deadline exceeded.")); return; }
      const req = request(url, {
        method: "GET", agent: false, lookup: pinnedLookup,
        headers: { "User-Agent": AUDIT_USER_AGENT, Accept: "text/html, application/xml, text/plain;q=0.9", "Accept-Encoding": "identity" },
      }, (res) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined && key !== "set-cookie") headers[key] = Array.isArray(value) ? value.join(", ") : value;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        const fail = (message: string) => { reject(new Error(message)); res.destroy(); req.destroy(); };
        if (Number(headers["content-length"]) > MAX_BYTES) { fail("Response is too large for a bounded audit."); return; }
        if (headers["content-encoding"] && headers["content-encoding"] !== "identity") { fail("Unsupported encoded response."); return; }
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) { fail("Response is too large for a bounded audit."); return; }
          chunks.push(Buffer.from(chunk));
        });
        res.on("end", () => resolve({ url: url.href, status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8"), headers }));
        res.on("aborted", () => reject(new Error("Response was aborted.")));
        res.on("error", reject);
      });
      requestTimer = setTimeout(() => { reject(new Error("Audit request timed out.")); req.destroy(); }, duration);
      req.on("error", reject);
      req.end();
    }).finally(() => clearTimeout(requestTimer));
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (!response.headers.location) throw new Error("Redirect has no destination.");
    next = new URL(response.headers.location, url).href;
  }
  throw new Error("Too many redirects in audit request.");
}
