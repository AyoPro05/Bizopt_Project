import { describe, it, expect } from "vitest";
import { slugify, appUrl } from "@/lib/helpers";

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("hello!@#world")).toBe("hello-world");
  });

  it("handles leading/trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("truncates to 48 characters", () => {
    const long = "this-is-a-very-long-string-that-exceeds-forty-eight-characters-total";
    const result = slugify(long);
    expect(result.length).toBeLessThanOrEqual(48);
  });

  it("converts to lowercase", () => {
    expect(slugify("HELLO World")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("collapses multiple separators", () => {
    expect(slugify("a   b   c")).toBe("a-b-c");
  });
});

describe("appUrl", () => {
  it("returns base URL with path", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.bizopt.com";
    expect(appUrl("/home")).toBe("https://app.bizopt.com/home");
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("uses localhost as fallback when env not set", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appUrl("/api/test")).toBe("http://localhost:3000/api/test");
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("handles root path", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.bizopt.com";
    expect(appUrl()).toBe("https://app.bizopt.com/");
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("does not double-slash paths", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.bizopt.com";
    expect(appUrl("settings")).toBe("https://app.bizopt.com/settings");
    process.env.NEXT_PUBLIC_APP_URL = original;
  });
});
