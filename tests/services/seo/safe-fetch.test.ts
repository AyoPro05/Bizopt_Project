// @vitest-environment node
import { EventEmitter } from "node:events";
import type { LookupAddress } from "node:dns";
import type { IncomingMessage, ClientRequest, RequestOptions } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isPublicAddress, safeFetch, validateAuditUrl } from "@/services/seo/safe-fetch";

const lookupMock = vi.mocked(lookup) as unknown as Mock<(hostname: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]>>;
const requestMock = vi.mocked(request);

function response(status: number, body = "", headers: Record<string, string> = {}) {
  const transport = (_url: unknown, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const req = Object.assign(new EventEmitter(), {
      end() {
        options.lookup!("example.com", {}, (_error, address) => {
          expect(address).toBe("93.184.216.34");
          const res = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn(), resume: vi.fn() });
          callback(res as unknown as IncomingMessage);
          res.emit("data", Buffer.from(body));
          res.emit("end");
        });
      },
      destroy: vi.fn(),
    });
    return req as unknown as ClientRequest;
  };
  requestMock.mockImplementationOnce(transport as typeof request);
}

beforeEach(() => {
  vi.resetAllMocks();
  lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("audit network boundary", () => {
  it.each(["127.0.0.1", "10.0.0.1", "100.64.0.1", "169.254.169.254", "172.31.1.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "3fff::1"])("rejects non-public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("permits public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each(["http://example.com", "https://user:pass@example.com", "https://localhost", "https://127.1", "https://[::1]", "https://example.com:444"])("rejects unsafe target %s", (url) => {
    expect(() => validateAuditUrl(url)).toThrow();
  });

  it("pins the vetted DNS address to the request and omits credentials", async () => {
    response(200, "hello", { "content-type": "text/plain" });
    const result = await safeFetch("https://example.com/");
    expect(result.body).toBe("hello");
    expect(lookupMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][1]).toMatchObject({ agent: false, method: "GET", headers: { "Accept-Encoding": "identity" } });
    expect((requestMock.mock.calls[0][1] as RequestOptions).headers).not.toHaveProperty("Cookie");
  });

  it("rejects a DNS answer set containing a private address before connecting", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.8", family: 4 }]);
    await expect(safeFetch("https://example.com")).rejects.toThrow(/public/i);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("validates every redirect and blocks a private destination", async () => {
    response(302, "", { location: "https://169.254.169.254/latest/meta-data" });
    await expect(safeFetch("https://example.com")).rejects.toThrow(/public/i);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("refuses redirects outside the authorised origin and path", async () => {
    response(302, "", { location: "/private" });
    await expect(safeFetch("https://example.com/blog", { scope: new URL("https://example.com/blog") })).rejects.toThrow(/scope/i);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("refuses responses larger than the fixed byte limit", async () => {
    response(200, "x".repeat(1_048_577));
    await expect(safeFetch("https://example.com")).rejects.toThrow(/large/i);
  });

  it("rejects a hostname redirect whose DNS changes to a private address", async () => {
    response(302, "", { location: "https://redirect.example.com/" });
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(safeFetch("https://example.com/")).rejects.toThrow(/public/i);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });

  it("rejects encoded separators that can escape the authorised path", async () => {
    await expect(safeFetch("https://example.com/blog/%2e%2e%2fadmin", { scope: new URL("https://example.com/blog") })).rejects.toThrow(/scope/i);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("rejects a redirect when the supplied robots policy disallows its destination", async () => {
    response(302, "", { location: "/blocked" });
    await expect(safeFetch("https://example.com/", { canRequest: (url) => url.pathname !== "/blocked" })).rejects.toThrow(/robots/i);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
