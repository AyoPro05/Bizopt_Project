# SEO Intelligence verification

Verified on 15 October 2026 on branch `feat/seo-intelligence`. The workspace already contained unrelated, uncommitted UI and schema changes; those were preserved. No production database, deployment, external publication, outreach recipient or paid provider was changed.

## Results

| Check | Command / conditions | Result |
| --- | --- | --- |
| Baseline | `npm test`, before SEO changes | 3 files, 34 tests passed |
| Full suite including PostgreSQL | `DATABASE_URL=<isolated-url> SEO_TEST_DATABASE_URL=<isolated-url> npm test` | **14 files, 174 tests passed, 0 failed, 0 skipped** |
| Standard suite | `npm test`, database tests not opted in | 13 files passed; 7 database cases intentionally skipped; run the opt-in command for full coverage |
| TypeScript | `npx tsc --noEmit` | Passed, no diagnostics |
| Repository lint | `npm run lint` | Passed, no ESLint warnings or errors |
| E2E script lint | `npx eslint tests/e2e/seo-workflow.mjs --max-warnings=0` | Passed |
| Schema | `npx prisma validate` | Passed |
| Prisma client | `npx prisma generate` | Passed |
| Production build | `SENTRY_AUTH_TOKEN= SENTRY_ORG= SENTRY_PROJECT= npm run build` | Passed; 61 static pages generated and all dynamic routes compiled |
| Additive migration | Existing pre-SEO schema → standalone SEO SQL in disposable PostgreSQL 18 | Tables, indexes and foreign keys applied successfully; six row-security statements separately applied and tested |
| Browser | Built production app, installed Chrome through Playwright, disposable local account/database | **19 final checks passed**, no browser JavaScript exceptions |

The build initially failed because the sandbox could not resolve the app's existing Google Fonts host; the network-enabled build passed. Existing Sentry instrumentation and Next lint deprecation notices remain. A build-cache write warning was resolved by clearing only the generated `.next/cache/webpack` directory; the final build completed successfully. No fonts, packages or framework versions were migrated.

## Automated coverage

- Deterministic intent classification, uncertainty, transparent priority scoring, deduplication and unknown provider metrics.
- CSV quoting/BOM/numeric validation, invalid dates, missing positions, weighted position and correct CTR; dimensional subtotals remain separate.
- Content brief schemas, safe template placeholders, content checks and Markdown export.
- Public IP validation, DNS pinning, per-redirect validation, response bounds, robots and sitemap handling, HTML observations and findings.
- Tenant-scoped service lookups, owner/admin management, optimistic version conflicts and serializable site budgets.
- Worker lease claims, permission rechecks, fenced completion, recovery, backoff and final failure.
- Same-origin mutation checks, bounded streamed bodies and JSON validation.
- Search Console HTTP adapter with mocked success, revoked credentials, permission, quota, invalid response and timeout contracts. These are **mocked provider tests, not a live connection**.
- Seven real PostgreSQL cases: website-to-export workflow; cross-tenant service/FK denial; immutable versions/stale writers; totals versus query imports; job deduplication; concurrent site budgets; direct browser-role denial under RLS.

## Browser checks and artifacts

The final reproducible run is recorded in [browser-results.json](seo-screenshots/browser-results.json). It checks existing sign-in, planning, editing, authenticated file download, reload/resume, version comparison, local checklist persistence, outreach draft persistence without sending, actual CSV import arithmetic, audit queuing/cancellation, cross-origin and unavailable-site denial, and JavaScript exceptions. Initial website onboarding also passed in the earlier run and is captured in its screenshot. No public customer website was crawled during browser QA.

- [Onboarding](seo-screenshots/onboarding-desktop.png)
- [Opportunities](seo-screenshots/opportunities-desktop.png)
- [Content and version comparison](seo-screenshots/content-desktop.png)
- [Imported results](seo-screenshots/results-desktop.png)
- [Desktop light](seo-screenshots/overview-1440-light.png), [desktop dark](seo-screenshots/overview-1440-dark.png)
- [Tablet light](seo-screenshots/overview-768-light.png), [tablet dark](seo-screenshots/overview-768-dark.png)
- [360px light](seo-screenshots/overview-360-light.png), [360px dark](seo-screenshots/overview-360-dark.png)
- [200% zoom](seo-screenshots/overview-200-percent.png)

There was no page overflow at 360, 768 or 1440 pixels in either mode. Primary-button text contrast was measured at at least 4.5:1 in both themes. Keyboard focus, 200% CSS zoom and reduced-motion settings passed smoke checks. These are bounded checks, not a full WCAG audit or an assertion that every screen has been tested at every zoom level. LCP/INP/CLS field percentiles were not measured.

## Reproduce safely

Use a disposable PostgreSQL cluster, never the app's configured database. The integration suite is deliberately restricted to `postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test` and requires `DATABASE_URL` and `SEO_TEST_DATABASE_URL` to match. Apply the current schema plus the SQL-only active-audit index and RLS statements before testing. The verified migration test instead first applied a pre-SEO schema snapshot and then the additive SQL. Tests create unique fixture tenants and clean only those fixtures.

For browser QA, seed the disposable database with an owner account `seo-browser@example.test`, fixture password `Local-test-password-42`, and a workspace. These are synthetic local credentials. Run the built app on `http://127.0.0.1:3105` with the isolated database URL, local test auth secret, matching `NEXTAUTH_URL`/`SEO_APP_ORIGIN`, empty beta allowlist, enabled SEO and disabled Sentry reporting. Start no audit worker; browser tests cancel audit jobs before any public-page fetch.

```sh
PLAYWRIGHT_MODULE=<installed-playwright-module-path> \
CHROME_EXECUTABLE=<installed-chrome-executable> \
node tests/e2e/seo-workflow.mjs
```

The script accepts an existing Playwright installation and Chrome executable, so no application dependency was added. The gstack browser helper could not run because its bundled Chromium was missing; installed Chrome was used instead. Browser fixture data is visibly labelled QA and lives only in the disposable database.

## Changed-file groups

| Files | Purpose |
| --- | --- |
| `prisma/schema.prisma`, `prisma/seo-intelligence-additions.sql` | Additive SEO persistence, composite tenancy, immutable versions, durable jobs, row security |
| `services/seo/{planning,content,metrics,audit,safe-fetch,workspace,jobs,providers,schemas,errors}.ts` | Browser-independent business rules, scoped persistence and bounded provider/worker boundaries |
| `lib/seo-context.ts`, `lib/seo-http.ts` | Auth/role/beta access, origin validation, request limits and redacted errors |
| `app/(app)/seo/*`, `components/seo/*` | Responsive six-destination workspace, editor, import forms and setup states |
| `app/api/seo/*`, `app/api/cron/seo/route.ts`, `workers/seo-worker.ts`, `package.json` | Thin authenticated handlers, scheduler endpoint and worker command |
| Existing Home, Integrations, navigation and resumable-session files | Small SEO entry points and exact saved-session links |
| `tests/services/seo/*`, `tests/e2e/seo-workflow.mjs` | Unit, service, provider-contract, PostgreSQL and browser coverage |
| `docs/SEO_INTELLIGENCE.md`, plan and screenshots | Setup, capability matrix, limitations and review evidence |

All implementation is local and reviewable. The SQL was not applied to the configured application database. Live Search Console OAuth, AI-generated factual drafts, CMS approvals/publishing, local-profile API metrics and licensed backlink datasets remain deferred as described in the capability matrix.
