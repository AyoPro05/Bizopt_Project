# SEO Intelligence implementation plan

**Goal:** Add an organisation-scoped website-to-content-to-measurement workflow to the existing BizOpt app, usable privately before a wider release.

**Architecture:** Keep the existing Next.js app, authentication, PostgreSQL/Prisma, editor sessions, semantic design tokens, and billing. Pure planning, content, and measurement functions sit in browser-independent services. Persist audit jobs in PostgreSQL and execute them through a worker or authenticated scheduler. The supplied engineering brief authorises implementation without another design approval.

**Scope:** Website onboarding and explicit public-audit authorisation; bounded HTML audits; explainable buyer-intent opportunities; local checklists; legitimate outreach drafts; versioned content and Markdown export; labelled Search Console CSV imports. Provider connections that require credentials, licensing, or project approval remain unavailable with setup instructions. No external writes or paid API calls are enabled.

**Approaches assessed:** A standalone dashboard would duplicate existing workspace infrastructure. Implementing every external provider immediately would depend on unavailable credentials and licences. Extend the existing workspace with a complete import-first workflow now, retaining clear integration boundaries.

**Design:** Reuse the teal accent, Fraunces headings, DM Sans controls, app navigation, topbar, form primitives, cards, and light/dark tokens. Six compact destinations: Overview, Opportunities, Content, Site Health, Local Visibility, Results. Lead with the next action; keep unknown metrics unavailable; use stacked task rows on mobile.

## Tasks

- [x] Add composite tenant-scoped SEO models and additive SQL migration. Preserve all pre-existing schema edits.
- [x] Write and run failing tests for planner scoring, CSV aggregation/validation, content review/export, SSRF, HTML observations, tenant denial, immutable versions, job claiming, and HTTP protections.
- [x] Implement deterministic planning and content templates with explicit provenance and unavailable volume/difficulty.
- [x] Implement a DNS-pinned, bounded public crawl that respects robots and reports observed HTML coverage.
- [x] Implement tenant-scoped workspace services, optimistic version checks, editor session persistence, search imports, manual local checklist, and outreach drafts.
- [x] Implement authenticated, same-origin mutation handlers with body limits, role checks, and persisted job budgets. No client-supplied organisation IDs.
- [x] Add the responsive SEO workspace and navigation, a compact Home entry, and provider setup in Integrations.
- [x] Add a durable worker and scheduler endpoint, bounded retries, leases, cancellation, and recovery.
- [x] Verify the full test suite, ESLint, TypeScript, Prisma validation, production build, and browser checks where available.
- [x] Write setup, migration/rollback, capability matrix, provider references, and exact verification results.

## Verification baseline

Before edits: `npm test` — 3 files, 34 tests passed. Working tree contains existing unrelated UI and schema changes; these must remain intact. Feature branch: `feat/seo-intelligence`.

## Release boundary

Do not deploy, alter existing subscriptions, apply migrations to a live database, send outreach, or publish content. Document live provider and deployment prerequisites. HTML checks do not assess rendered JavaScript, field performance, Google index status, or rich-result eligibility. Manual local checklists do not imply a Business Profile API connection. Imported query rows do not replace property totals.

## Completion evidence

Implemented the selected import-first slice. Full suite: 174 tests passed across 14 files with PostgreSQL enabled. Production build, TypeScript, lint and Prisma validation passed. Final browser run: 19 checks passed with responsive/light/dark screenshots. See `docs/SEO_VERIFICATION.md`; live provider connections and external writes remain deferred.
