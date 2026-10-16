# Access, signup and dependency hardening — 16 October 2026

This implements the first priority in [the app audit](APP_AUDIT_2026-10-16.md). Changes are local to `feat/platform-experience`; no production database, email delivery, payment, publishing or deployment was exercised.

## Changed behavior

- Workspace editor reads, edits, stage completion, snapshots and audit helpers require the current person's session, organization and active membership before accessing data. Another organization or another member's personal editor session returns not found without changing records.
- Strict editor schemas reject ownership changes, nested Prisma operations, server-controlled state and invalid stages. Content and media references must belong to the current organization. Routes bound JSON requests to 32 KiB and use the shared authentication, permission and mutation-origin checks.
- Stage completion and snapshot restoration commit their snapshot and state change together. A failed write rolls back the snapshot. Restore binds the snapshot to the authorized session and clears nullable fields correctly.
- Identity advisory locks now return a Prisma-compatible scalar while retaining the transaction lock. Registration, verification, recovery and credential/session revocation regressions run against PostgreSQL. `.env.example` includes the required identity encryption/origin and notification settings.
- Private editor tables have an additive RLS script at [prisma/workspace-session-security.sql](../prisma/workspace-session-security.sql), with no browser policies.

## Dependencies

The lockfile resolves Next.js 15.5.28, NextAuth 4.24.15, Prisma adapter 2.11.3 and Vitest 4.1.12. Compatible transitive updates are included.

Three narrow overrides remove vulnerable versions pinned upstream: Auth.js core 0.41.3 (including NextAuth's optional peer), Next's PostCSS 8.5.30, and Prisma config's deepmerge-ts 8.0.2. Clean `npm ci`, Prisma generation/database preparation, identity tests, the production build and native Sharp AVIF encode/decode were verified with these versions.

`npm audit --omit=dev` reports **zero vulnerabilities**. The full audit still reports **five high development dependency entries from one advisory**, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), through the Next ESLint plugin → fast-glob → micromatch → braces chain. The checked braces release is 3.0.3 and remains affected. The audit's proposed Next lint downgrade is not applied. This exception remains visible; it is not a clean full-dependency audit. Update the lint dependency chain when a compatible fix is available.

## CI enforcement

The workflow provisions PostgreSQL 16 and runs `db:generate`, `db:test:prepare` and `test:ci`. Database tests run serially and every collected test must pass: missing datasource settings, skipped tests, deferred tests, empty runs and failed tests fail the job. A separate production dependency audit fails on moderate or higher advisories. Deployment depends on lint, database/security tests, dependency audit and build. The invalid action `use` key is corrected to `uses`.

The disposable datasource must be exactly one of the two loopback URLs in [scripts/test-database-config.mjs](../scripts/test-database-config.mjs), and all four variables must match:

```sh
export DATABASE_URL=postgresql://seo_test@127.0.0.1:55439/bizopt_ci_test
export SEO_TEST_DATABASE_URL="$DATABASE_URL"
export PLATFORM_TEST_DATABASE_URL="$DATABASE_URL"
export AUTOMATION_TEST_DATABASE_URL="$DATABASE_URL"
npm ci
npm run db:generate
npm run db:test:prepare
npm run test:ci
```

Preparation accepts only an **empty** disposable database and refuses to reset existing tables/data. It builds the Prisma schema and reapplies the SQL-only RLS, indexes, notification tenant foreign key and checks from the existing migration sources plus the editor RLS script. It is a test bootstrap, not a production migration runner. Use `test:ci` directly when reusing an already prepared test database.

Before merging, configure GitHub's protected-branch rules/ruleset to require the checks named **Lint**, **Database and security tests**, **Production dependency audit** and **Build**. Workflow source alone cannot enforce merge protection. Remote settings have not been changed or verified in this task.

## Release prerequisite

Apply `prisma/workspace-session-security.sql` through the deployment's database change process after the editor tables exist. Confirm the application server uses its intended table-owner/BYPASSRLS role; browser roles receive no policy. The script was applied and tested only in the disposable database. Production data/schema have not been changed.

## Verification

- Clean `npm ci` succeeds.
- `npm run test:ci`: **443 tests across 63 files pass, zero skipped or deferred**, including real database authorization, input rejection, snapshot rollback/restore, browser-role RLS and HTTP signup regressions.
- `npx tsc --noEmit --incremental false` and `npm run lint`: pass.
- `npm run audit:production`: zero vulnerabilities.
- `BIZOPT_BUILD_NO_CACHE=true npm run build`: passes. The existing Sentry instrumentation warning remains.
- Native Sharp AVIF encode/decode: passes.
- Chrome 155 against the production build over local HTTPS: signup returns 201; check-email preserves the selected plan; the verification proof leaves the address bar before confirmation; confirmation persists email verification without activating paid access; NextAuth credentials sign-in preserves the plan destination. No browser exceptions were recorded. Email proof was obtained from the disposable encrypted outbox; no delivery worker ran.

Local evidence is retained in the ignored [.gstack/qa-reports/hardening-2026-10-16](../.gstack/qa-reports/hardening-2026-10-16/) directory. Other findings in the original audit, including simulated publishing and storage/worker deployment gaps, remain outside this change.
