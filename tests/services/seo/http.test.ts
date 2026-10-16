// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { checkSeoMutation, readSeoJson } from "@/lib/seo-http";

describe("SEO HTTP boundaries", () => {
  beforeEach(() => vi.stubEnv("SEO_APP_ORIGIN", "https://bizopt.example"));
  afterEach(() => vi.unstubAllEnvs());
  it("rejects cross-origin and originless cookie mutations", () => {
    expect(() => checkSeoMutation(new Request("https://bizopt.example/api/seo", { method: "POST", headers: { origin: "https://evil.example" } }))).toThrow("origin");
    expect(() => checkSeoMutation(new Request("https://bizopt.example/api/seo", { method: "POST" }))).toThrow("origin");
  });
  it("accepts the same origin and authenticated bearer clients", () => {
    expect(() => checkSeoMutation(new Request("https://bizopt.example/api/seo", { method: "POST", headers: { origin: "https://bizopt.example" } }))).not.toThrow();
    expect(() => checkSeoMutation(new Request("https://bizopt.example/api/seo", { method: "POST", headers: { authorization: "Bearer a-token" } }))).not.toThrow();
  });
  it("bounds streamed request bodies even without Content-Length", async () => {
    const req = new Request("https://bizopt.example/api/seo", { method: "POST", body: JSON.stringify({ value: "x".repeat(50) }) });
    await expect(readSeoJson(req, 20)).rejects.toThrow("large");
  });
  it("reports invalid JSON as a validation error", async () => {
    await expect(readSeoJson(new Request("https://bizopt.example", { method: "POST", body: "broken" }))).rejects.toThrow("JSON");
  });
});
