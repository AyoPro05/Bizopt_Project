# Platform and SEO integrated verification

Verified locally on 15 October 2026. This is a tested implementation increment for operator use and review before public release. No production database, real invitation delivery, customer subscription, price or charge was changed.

## Delivered capabilities

- Account identity, profile, workspace switching, notification/recovery preferences, password-confirmed session revocation and private export/deletion review requests.
- Central owner/admin/member capabilities, server-revocable browser and mobile sessions, fail-closed bearer handling and same-origin cookie mutations.
- Base includes 2 people; Team includes 5 at a fixed 140% of Base, rounded half up in minor units. The approved policy is one active device per person. Occupancy does not change the selected recurring amount.
- Explicit invitation preview/approval, serializable seat reservations, verified matching-email acceptance, expiring single-use proof, revoke/resend and bounded durable delivery. Links carry proof in fragments, remove it immediately and retain it only in memory.
- Provider-quoted paid upgrades, pending-payment entitlements, renewal downgrades, future capacity checks and cancellation. Stripe fixture contracts cover these operations; live Stripe validation is still required before enabling public paid plan changes.
- Private support reports, consent-only diagnostics, in-app conversations and staff-only notes. Separate staff enrollment, password plus replay-resistant TOTP, short grants tied to live browser sessions and audited private access protect the console.
- Searchable versioned help; responsive account/workspace shell; preserved SEO onboarding, planning, editable versioned drafts/export, imported Search Console measurement, bounded public-page audits, manual local checklists and outreach drafts.
- Local SEO recovery defaults off. Replay monitoring is disabled and configured event hooks redact identities, request bodies and URL query/fragment values.

## Automated and database checks

`npx prisma generate`, TypeScript checking, ESLint and the production build passed. The full Vitest run passed **275 tests across 31 files**, including all **17 real PostgreSQL integration tests** (7 SEO and 10 platform), with none skipped. Stripe and email transport calls are mocked; these are not live provider certifications.

The database tests require both the normal datasource and explicit test datasource to equal the exact disposable loopback URL. Example, after preparing that isolated database:

```sh
DATABASE_URL=postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test \
PLATFORM_TEST_DATABASE_URL=postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test \
SEO_TEST_DATABASE_URL=postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test npm test
npx tsc --noEmit
npm run lint
BIZOPT_BUILD_NO_CACHE=true npm run build
```

`BIZOPT_BUILD_NO_CACHE` only disables generated webpack caching for constrained local disks. Existing Next lint deprecation, Vite config-loader and Sentry instrumentation notices remain. No measured performance or accessibility certification is claimed.

Integration coverage includes tenant foreign keys and browser-role RLS denial; immutable SEO versions and imports; concurrent site, audit and seat budgets; approval retry deduplication; matching verified invitation identity, replay and revocation; last-owner protection; immediate member/device access removal; independent personal devices; support customer privacy/internal-note filtering, optimistic conflicts and diagnostics redaction; real encrypted MFA enrollment, counter reuse denial, grant/session revocation; explicit preferences and the scheduled Base reservation ceiling. Additional fixture tests exercise webhook/invitation leases, failures, retries, provider idempotency and fixed plan arithmetic.

## Browser evidence

See [platform results](platform-screenshots/results.json), [SEO results](seo-screenshots/browser-results.json), [platform browser script](../tests/e2e/platform-workflow.mjs) and [SEO browser script](../tests/e2e/seo-workflow.mjs). Scripts are restricted to the disposable local server and synthetic accounts. The platform script seeds disposable fixtures, uses fake provider credentials and never runs the delivery worker or a real checkout. Fixture secrets embedded in test code are local test values and must never configure a deployed environment.

Browser results: 14 platform checks and 19 SEO checks passed with zero runtime exceptions. Chrome 155.0.8059.40 on macOS; 320/768/1440 CSS px for the workspace in light/dark, navigation focus/Escape, account menu focus restoration, and 320 CSS px for settings/help/support/billing (1280px at 400% reflow equivalent). SEO includes 360/768/1440 light/dark, primary button contrast, 200% CSS zoom, keyboard/reduced-motion smoke checks, editing/export, import arithmetic, audit cancellation and HTTP boundaries. Reflow equivalence is not a claim that physical browser zoom or assistive technologies were exhaustively tested. Safari/iOS, Firefox, Android, screen readers and physical devices remain untested release targets.

## Migration and operator setup

This repository uses standalone SQL additions, not a complete Prisma migration history. Back up and review schema drift in the target environment first. Apply `prisma/seo-intelligence-additions.sql` once, followed by `prisma/platform-experience-additions.sql` once; regenerate Prisma, then deploy the matching application. The platform migration was applied successfully to the disposable database containing the earlier SEO schema/data. It adds tables/columns and changes device uniqueness to include person identity; it deletes no content. Existing devices are assigned to a sole owner when unambiguous; unassigned multi-owner records require explicit authorization. New private tables enable RLS with no browser policies. The server requires its existing privileged table-owner/BYPASSRLS connection, and service-level tenant checks still apply.

Keep added tables/data when rolling back application behavior. Disable invitation/SEO flags, stop their schedulers and retain records for review. Do not run destructive schema rollback to disable features. Old mobile access tokens without persisted session identity must sign in again. Existing browser JWTs register during rollout only while the account revocation version remains zero; after global revocation, old JWTs cannot register again.

Configure server secrets through the deployment secret manager, using `.env.example` as a field inventory:

- Billing: reviewed existing `STRIPE_PRICE_ID`, `STRIPE_TEAM_PRICE_ID`, same-currency monthly fixed prices, and `STRIPE_PORTAL_CONFIGURATION_ID` with plan updates disabled. No price object is created automatically. Validate live test-mode payment, tax, 3DS/decline, renewal, schedule cancellation and webhook recovery before public rollout.
- Invitations: `TEAM_INVITATIONS_ENABLED=true`, `TEAM_DEVICE_POLICY=per_person`, random `INVITE_TOKEN_SECRET` of at least 32 characters, `RESEND_API_KEY`, reviewed `INVITE_FROM_EMAIL`, and canonical HTTPS `INVITE_APP_ORIGIN`. Existing account email verification must work. Rotating the token secret requires explicit resend to replace outstanding proof.
- Staff: random base64 32-byte `SUPPORT_ENCRYPTION_KEY` and separately approved enrollment. Follow [support enrollment](PLATFORM_SUPPORT.md); do not use test accounts or keys.
- SEO: enable `SEO_INTELLIGENCE_ENABLED`; optionally restrict `SEO_BETA_ORG_IDS`; pin `SEO_APP_ORIGIN` to the canonical deployment origin. Live OAuth, publishing, backlink data and external AI support processing remain deferred as documented in [SEO capabilities](SEO_INTELLIGENCE.md).
- Scheduling: invoke `worker:invitations`, `worker:seo` and `worker:webhook` regularly through the approved job runner. Protected cron endpoints for invitations/SEO require `CRON_SECRET`; no scheduler is silently provisioned. Stripe inbox leases expire after 3 minutes and stop after 5 attempts in `dead_letter`; invitation/audit retries stop after 3 attempts. Monitor exhausted/failed records and provider confirmation. Resolve ambiguous provider state before an operator resets retry counters.

Before public release, verify provider credentials/permissions and actual delivery, staffing, operational alerting, shared abuse limiting, retention/storage quotas, private support notices and secure secret provisioning; complete the remaining browser/device and accessibility matrix. No native app, referral reward programme, guaranteed search ranking/customer acquisition, completed backlink placement, legal compliance certification or production deployment is represented as delivered.
