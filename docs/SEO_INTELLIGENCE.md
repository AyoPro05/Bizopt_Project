# SEO Intelligence

SEO Intelligence extends the current BizOpt workspace at `/seo`. This is an import-first private-beta slice. It helps an owner turn their business goals into opportunities, inspect a bounded sample of their public website, write versioned content and measure imported search performance. It does not guarantee rankings, backlinks or customers.

## Start using it

1. Back up the application database and review `prisma/seo-intelligence-additions.sql`. Apply the additive SQL once to an existing database, then run `npx prisma generate`. The SQL creates six SEO tables, composite tenant foreign keys, an editor-session index and a unique active-audit index; it does not rewrite existing data. Run it with the database's migration/admin account. The server database role must own these tables or have `BYPASSRLS`; browser-facing database roles receive no direct policies. This repository has no baseline Prisma migration history: do not assume `prisma migrate deploy` will initialise an existing database correctly.
2. Start the app using its existing authentication and database configuration. Open **SEO** in the shared navigation. Only workspace owners and admins can add and authorise a website. Members can work with already-authorised websites and drafts.
3. Add your actual website URL, services, audience, business goal, language and optional real service areas. Confirm you own the site or have permission to inspect its public pages. This authorisation is recorded; it is not independently verified domain ownership and grants no CMS access.
4. Select **Create SEO plan**. Review the evidence and choose an opportunity. Open its brief, replace factual placeholders with useful original copy, save a version and export Markdown. The editor preserves a browser recovery copy when storage is available and detects stale server versions. Use saved content, not an unsaved browser copy, for exports.
5. In **Site Health**, queue an audit. A separately scheduled worker must run. Locally use `npm run worker:seo` for one tick; invoke it regularly with a process scheduler. Alternatively schedule authenticated `GET /api/cron/seo` with `Authorization: Bearer <CRON_SECRET>`. The endpoint processes at most one job per invocation and has a 60-second deployment duration setting. No scheduler is silently installed or enabled by this change.
6. In **Results**, paste or upload an English Search Console CSV export. Supply the exact domain or URL-prefix property, report period and search type. Import Date totals separately from Top queries/Top pages. Query and page reports remain partial row subtotals; they never replace property totals. CTR is computed from clicks/impressions and position uses impression weighting only when all contributing rows have a position. Reports with different properties, search types, overlapping periods or unequal duration are not directly compared. Search Console uses Pacific reporting dates; date labels retain that calendar basis.
7. Local businesses can complete the manual **Local Visibility** checklist. Under **Opportunities → Authority**, record a relevant organisation and why a collaboration would help its audience. Review and personalise the saved outreach draft before copying it into your own sending workflow.

## Configuration

Existing authentication, device, billing and subscription prices are unchanged. No new dependency or paid-provider entitlement was introduced. This slice makes no paid AI or SEO-provider calls through the UI.

```dotenv
# Existing values, shown as placeholders only:
DATABASE_URL=postgresql://<server-role>:<password>@<database-host>/<database>
NEXTAUTH_SECRET=<existing-authentication-secret>
NEXT_PUBLIC_APP_URL=https://<your-app-host>

# Optional SEO controls:
SEO_INTELLIGENCE_ENABLED=true
SEO_APP_ORIGIN=https://<canonical-app-host>
SEO_BETA_ORG_IDS=<private-workspace-id>,<another-workspace-id>
CRON_SECRET=<long-random-server-only-scheduler-secret>
```

`SEO_INTELLIGENCE_ENABLED=false` disables SEO API access. A nonempty `SEO_BETA_ORG_IDS` restricts access to those organisations; omit it when opening access more widely. `SEO_APP_ORIGIN` optionally pins cookie-authenticated mutations to a canonical origin; if omitted the request URL's origin is used, which supports isolated preview hosts. These flags do not change subscription prices or provider licensing. Vercel deployments need a configured scheduler and a plan/runtime that supports the audit duration. Keep the cron secret server-side.

## Capability matrix

| Capability | Status | Evidence or limitation |
| --- | --- | --- |
| Website onboarding, multiple sites, scoped authorisation | Implemented | Up to 10 sites; owner/admin setup; tenant foreign keys |
| Buyer-intent planner and opportunity queue | Implemented | Versioned deterministic heuristic with explanation; web-query imports; unknown volume/difficulty |
| Brief and editable draft | Implemented | Validated deterministic template, explicitly labelled; factual review required |
| Server versions, session resume, comparison and Markdown export | Implemented | Optimistic locking; no HTML rendering; old versions retained |
| Public-page audit | Implemented; fixture-tested transport | DNS-pinned HTTPS; public addresses only; per-hop redirects and scope checks; no live customer website audited during verification |
| Durable job execution | Implemented | PostgreSQL leases, fenced completion, cancellation, three attempts, jitter/backoff, recovery; external scheduler must be configured |
| Search Console CSV measurement | Implemented | Explicit report metadata; totals/breakdown distinction; no verification that uploaded files came from Google |
| Read-only Search Console HTTP adapter | Contract-tested with mocked responses | No OAuth UI, refresh credentials, incremental sync or live provider test |
| Local checklist and outreach draft | Implemented manual workflow | No Maps scraping, backlink discovery, sending, profile edits or claimed local rank |
| Search Console OAuth and scheduled imports | Deferred | Requires signed state + single-use nonce, least-privilege OAuth, secure token storage, refresh/revocation and sync watermarks |
| Google Business Profile | Deferred / API access unconfigured | Requires Google project approval and authorised profiles; no engagement metrics shown |
| WordPress publishing and approvals | Deferred | Markdown export available; no credentials or external write paths |
| Semrush/backlink intelligence | Deferred / licence unconfigured | No authority score or backlink metrics fabricated |
| AI synthesis, advanced clustering, rendered browser audits, PageSpeed, GA4/CRM | Deferred | No AI-generated factual copy or advanced provider data represented as available |

## Audit scope and limits

An audit checks observed HTML only, with at most 12 pages, depth 2, one request at a time, 40 seconds, 1 MB per response, three sitemap documents and 200 findings. Scope stays within the submitted HTTPS origin and path. Requests use no credentials, reject non-public IPv4/IPv6 addresses, pin DNS to the vetted address and revalidate redirects. Robots unavailability blocks crawling except an explicit 404. Robots access is not ownership proof. The crawler reports status, metadata, heading, canonical, indexability, alt coverage, structured-data syntax and broken observed links, with coverage limitations. It does not execute JavaScript or establish actual Google indexing, rich-result eligibility, mobile usability or performance. Robots crawl-delay is respected within the hard duration limit; an excessive delay results in limited coverage. Cancellation immediately fences result persistence; an already-running bounded request may finish.

Workspaces can queue at most ten audit runs per rolling 24 hours. Pending requests reuse an existing job. Serializable transactions protect site and audit budgets; concurrent conflicts can require retrying the action. HTTP mutation throttling is an in-process backstop; use a shared edge limiter before a larger launch. Search imports and content storage do not yet have metered retention; establish storage quotas and deletion/retention policy before a public launch. Jobs never rely on an open browser.

## Provider setup for later slices

- **Search Console:** create a Google Cloud project and enable Search Console API; configure a server-side OAuth client and verified redirect URI with `https://www.googleapis.com/auth/webmasters.readonly`. Preserve `sc-domain:` versus URL-prefix semantics. Query endpoint: `POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`. The isolated adapter requests final web rows, encodes the exact property, validates output, distinguishes revoked/permission/quota errors and always labels top-row results partial. Configure secrets only when implementing the encrypted connection lifecycle. [Query reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [reporting coverage](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data).
- **Business Profile:** request project approval, enable the approved APIs and authorise the user's actual profiles. Maps credentials do not provide profile-management rights. Recheck quota and supported metrics before implementing; call clicks must never be labelled completed calls or customers. [Prerequisites](https://developers.google.com/my-business/content/prereqs).
- **WordPress:** probe the configured site's REST API and use a dedicated least-privilege account with an Application Password over HTTPS where supported. Implement encrypted secret storage, exact-version/destination approval, conflict detection, remote-ID mapping and ambiguous-timeout reconciliation before enabling any writes. Core posts and plugin SEO fields are separate capabilities. [Authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/).
- **Semrush:** select an API product and credential model; verify plan access, quotas, per-job cost and rights to store/display/redistribute data. Do not assume ordinary subscriptions grant the required API rights. Keep paid jobs disabled until cost controls and explicit authorisation exist. [API access](https://developer.semrush.com/api/v4/get-started/api-access/).
- **PageSpeed:** select and configure an approved provider separately. Label lab results and field observations distinctly. [PageSpeed reference](https://developers.google.com/speed/docs/insights/v5/get-started).

Provider references were checked on 15 October 2026. Costs and licensing must be rechecked against the chosen account/product before enabling a provider. Existing social publishing approvals must be preserved when adding content reuse. There is no approval system for SEO external writes in this slice because no SEO external write endpoint exists.

## Migration and rollback

The SQL is a reviewed standalone additive migration, matching the repository's existing SQL-additions convention. Do not run it twice. The partial active-job index and RLS are SQL-only additions. Apply the schema and server-role access before enabling the UI, because the shared resumable-session query now includes SEO content.

To roll back application behavior, disable SEO and deploy the preceding application revision while retaining the new tables and index. This preserves SEO drafts. A database rollback that drops SEO tables destroys those records and must follow export/backup and explicit operator approval. Do not revert unrelated existing schema or UI changes. Database verification was performed against a fresh local PostgreSQL instance by applying the pre-change schema followed by this additive SQL; no configured application database was changed.

## Verification and next release gate

See `docs/SEO_VERIFICATION.md` for exact commands/results and screenshots. Unit tests cover metric arithmetic, intent/scoring, content validation, HTML findings, SSRF/redirects/robots and provider contract failures. Mocked-service tests cover tenancy filters, versions, leases/retries and HTTP boundaries. Opt-in PostgreSQL tests exercise actual composite foreign keys and the end-to-end content/import workflow. Browser verification uses disposable local accounts/data, separate from application data.

The next highest-value slice is authenticated Search Console OAuth plus a daily incremental sync, using property-level aggregates alongside clearly partial dimensional rows. Then add configured AI drafting with existing entitlements, validated schemas, evidence and durable cost accounting. Before opening the beta broadly, complete live provider tests, role/security review, storage limits/deletion policy, accessibility audit, measured p75 performance and deployed scheduler monitoring. No production-readiness or unmeasured Web Vitals claim is made.

## Account privacy integration

Browser draft recovery defaults to off and requires the explicit account preference. The SEO editor only reads/writes recovery copies after opt-in, scopes keys to the signed-in user and site, and removes the copy when disabled. Server versions remain the durable save mechanism. Account logout and workspace switching clear BizOptz client caches. Monitoring replay is disabled; request bodies, identities and URL query/fragment values are excluded from configured monitoring hooks. See [PLATFORM_VERIFICATION.md](PLATFORM_VERIFICATION.md) for the integrated regression run.
