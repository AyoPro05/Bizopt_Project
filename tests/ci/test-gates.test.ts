// @vitest-environment node
import { describe, expect, it } from "vitest";
import { requireTestDatabaseEnvironment, assertCompleteTestRun } from "@/scripts/test-database-config.mjs";

const url = "postgresql://seo_test@127.0.0.1:55439/bizopt_ci_test";
const config = () => ({ DATABASE_URL: url, SEO_TEST_DATABASE_URL: url, PLATFORM_TEST_DATABASE_URL: url, AUTOMATION_TEST_DATABASE_URL: url });

describe("required CI database and security gates", () => {
  it("accepts only the explicitly configured disposable loopback database", () => {
    expect(requireTestDatabaseEnvironment(config())).toBe(url);
    for (const invalid of ["postgresql://seo_test@db.example.com:55439/bizopt_ci_test", "postgresql://seo_test@127.0.0.1:55439/app", `${url}?schema=public`]) {
      const env = Object.fromEntries(Object.keys(config()).map(key => [key, invalid]));
      expect(() => requireTestDatabaseEnvironment(env)).toThrow("disposable");
    }
  });
  it("fails before running tests when any datasource is missing or points elsewhere", () => {
    for (const key of Object.keys(config())) {
      expect(() => requireTestDatabaseEnvironment({ ...config(), [key]: undefined })).toThrow();
      expect(() => requireTestDatabaseEnvironment({ ...config(), [key]: "postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test" })).toThrow();
    }
  });
  it("fails a nominally successful run if any regression was skipped or deferred", () => {
    const passed = { success: true, numTotalTests: 10, numPassedTests: 10, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 };
    expect(() => assertCompleteTestRun(passed)).not.toThrow();
    for (const run of [{ ...passed, numPendingTests: 1 }, { ...passed, numTodoTests: 1 }, { ...passed, numTotalTests: 0, numPassedTests: 0 }, { ...passed, numPassedTests: 9 }, { ...passed, success: false }]) {
      expect(() => assertCompleteTestRun(run)).toThrow();
    }
  });
});
