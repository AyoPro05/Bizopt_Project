import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireTestDatabaseEnvironment, assertCompleteTestRun } from "./test-database-config.mjs";

requireTestDatabaseEnvironment();
const directory = mkdtempSync(join(tmpdir(), "bizopt-ci-tests-"));
const report = join(directory, "results.json");
try {
  const run = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--fileParallelism=false", "--reporter=default", "--reporter=json", `--outputFile=${report}`], { cwd: fileURLToPath(new URL("../", import.meta.url)), env: process.env, stdio: "inherit" });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exitCode = run.status ?? 1;
  else {
    const result = JSON.parse(readFileSync(report, "utf8"));
    assertCompleteTestRun(result);
    console.log(`CI verified ${result.numPassedTests} tests with no skipped or deferred regressions.`);
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
