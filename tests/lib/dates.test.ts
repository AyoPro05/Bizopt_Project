import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, isWithinRefundWindow } from "@/lib/dates";

describe("formatDate", () => {
  it("formats a valid date", () => {
    expect(formatDate(new Date("2024-03-15T10:30:00Z"))).toBe("Mar 15, 2024");
  });

  it("returns em-dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("handles date string input", () => {
    expect(formatDate("2024-12-25T00:00:00Z")).toBe("Dec 25, 2024");
  });
});

describe("formatDateTime", () => {
  it("formats date with time", () => {
    expect(formatDateTime(new Date("2024-03-15T14:30:00Z"))).toBe("Mar 15, 2024 · 2:30 PM");
  });

  it("returns em-dash for null", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("isWithinRefundWindow", () => {
  it("returns true for a date within the window", () => {
    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    expect(isWithinRefundWindow(recent, 7)).toBe(true);
  });

  it("returns false for a date outside the window", () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    expect(isWithinRefundWindow(old, 7)).toBe(false);
  });

  it("returns true for date near the start of the window", () => {
    const now = new Date();
    const createdAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    expect(isWithinRefundWindow(createdAt, 7)).toBe(true);
  });

  it("returns false for date exactly at window end", () => {
    const now = new Date();
    const createdAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    expect(isWithinRefundWindow(createdAt, 7)).toBe(false);
  });
});
