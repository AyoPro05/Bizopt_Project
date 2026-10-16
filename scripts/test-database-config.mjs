export const DISPOSABLE_DATABASE_URLS = [
  "postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test",
  "postgresql://seo_test@127.0.0.1:55439/bizopt_ci_test",
];

export function disposableTestDatabase(value) {
  return DISPOSABLE_DATABASE_URLS.includes(value) ? value : undefined;
}

/** @param {Record<string, string | undefined>} env */
export function requireTestDatabaseEnvironment(env = process.env) {
  const url = disposableTestDatabase(env.DATABASE_URL);
  if (!url || ["SEO_TEST_DATABASE_URL", "PLATFORM_TEST_DATABASE_URL", "AUTOMATION_TEST_DATABASE_URL"].some(key => env[key] !== url)) {
    throw new Error("All database test variables must equal an approved disposable loopback database.");
  }
  return url;
}

export function assertCompleteTestRun(result) {
  if (result.success !== true || result.numTotalTests < 1 || result.numPassedTests !== result.numTotalTests || result.numFailedTests !== 0 || result.numPendingTests !== 0 || (result.numTodoTests ?? 0) !== 0) {
    throw new Error("CI requires every test to pass: skipped, deferred, failed or empty runs are not accepted.");
  }
}
