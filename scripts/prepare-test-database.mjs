import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { requireTestDatabaseEnvironment } from "./test-database-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = requireTestDatabaseEnvironment();
const db = new PrismaClient({ datasourceUrl: url });

try {
  const [{ count }] = await db.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`;
  if (count !== 0) throw new Error("Test database must be empty. Existing tables and data will not be reset.");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { cwd: root, stdio: "inherit" });

  // Reuse the security DDL shipped by the SQL migrations; db push alone omits
  // their RLS, partial indexes, checks and additional notification tenant key.
  const sources = ["prisma/seo-intelligence-additions.sql", "prisma/platform-experience-additions.sql", "prisma/lifecycle-automation-additions.sql", "prisma/workspace-session-security.sql"];
  const statements = [];
  for (const source of sources) {
    const sql = (await readFile(new URL(`../${source}`, import.meta.url), "utf8")).replace(/^\s*--.*$/gm, "");
    for (const statement of sql.split(";").map(value => value.trim()).filter(Boolean)) {
      if (/^ALTER TABLE "\w+" ENABLE ROW LEVEL SECURITY$/.test(statement)
        || /^CREATE (UNIQUE )?INDEX "(SeoAuditRun_active_site_key|OutboxEvent_id_orgId_key|Subscription_reconciliation_attempt_idx)"/.test(statement)
        || /^ALTER TABLE "Notification" ADD CONSTRAINT "Notification_event_tenant_fkey"/.test(statement)
        || /^ALTER TABLE "(OutboxEvent|Notification|CommercialConsent)" ADD CONSTRAINT "\w+" CHECK /.test(statement)) statements.push(statement);
    }
  }
  await db.$transaction(async tx => {
    const roles = await tx.$queryRaw`SELECT 1 FROM pg_roles WHERE rolname = 'seo_browser_check'`;
    if (!roles.length) await tx.$executeRawUnsafe("CREATE ROLE seo_browser_check NOLOGIN");
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 15000 });
  console.log(`Prepared an empty disposable PostgreSQL database with ${statements.length} migration security statements.`);
} finally { await db.$disconnect(); }
