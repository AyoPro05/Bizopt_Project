# Email delivery operations

Implementation uses Next.js 15, Prisma/PostgreSQL 6 and installed Resend 6.12.4. PostgreSQL is the durable queue; Redis is not required or installed. Domain actions must call `emitEvent` inside their existing transaction. A mail outage never rolls back a committed password/payment/account change. There is no exactly-once delivery promise.

## Configuration and startup

Set explicit trusted `APP_URL` (origin only; HTTPS in production), `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SUPPORT_URL`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_WEBHOOK_SECRET`, and `NOTIFICATION_PAYLOAD_KEY` (base64 encoding of exactly 32 independent random bytes). Do not reuse authentication, Stripe or support MFA secrets. `RESEND_API_KEY` is an explicit legacy provider-key alias; NEXTAUTH_URL / NEXT_PUBLIC_APP_URL are explicit legacy origin aliases. No default business domain, support address or production sender is invented. Optional `NOTIFICATION_UNSUBSCRIBE_SECRET` must have at least 32 characters; otherwise an HMAC purpose-derived from the notification key signs expiring optional-category confirmations.

Run `notificationConfig()` before starting web/worker traffic. Identity preflight can validate the encryption key and trusted app origin independently so a missing provider key does not reverse domain work. Database and auth/Stripe configuration are validated by their existing services. Configure different provider projects/secrets for staging and production. Do not print environment values or raw request bodies.

Operator setup must verify the owned sending domain, provider DNS records and mailbox identities. Publish the exact SPF/DKIM values supplied by the provider; do not duplicate SPF policies. Roll out aligned DMARC after reviewing aggregate reports, then tighten the policy using the organization's approved domain policy. Disable open/click tracking on the transactional sending domain, especially for recovery/verification links. Domain settings are external deployment work, not applied by this code. [Resend domain documentation](https://resend.com/docs/dashboard/domains/introduction) describes ownership verification and domain tracking controls.

Create `/api/webhooks/email` in the Resend dashboard for sent/delivered/delayed/bounced/complained/failed/suppressed events. Configure its exact signing secret. The route verifies the untouched raw body with the installed SDK and signed Svix headers before unique durable acceptance; it processes no message content inline. Opens/clicks are ignored. [Provider verification documentation](https://resend.com/docs/webhooks/verify-webhooks-requests) requires raw-body verification. Configure proxy body limits at or below 256 KiB as well as the application limit.

## Worker deployment

Apply the additive migration and generate Prisma before starting the new application and workers. Existing rows/auth adapter tables are preserved. Workers use the same migrated database and notification keys as the web service, with a minimum-privilege server role. Verify row-level access policies deny browser/public access to delivery/secret tables. Do not run production migration until its reviewed deployment gate is complete.

Run these ticks repeatedly from independently managed worker/scheduler processes:

```sh
npx tsx workers/outbox-worker.ts
npx tsx workers/notification-worker.ts
npx tsx workers/notification-reconciliation-worker.ts
```

The wrappers deliberately run one tick and exit. A deployment scheduler must invoke them continuously; running a single tick is not a durable worker service. Prefer the root `workers/automation-worker.ts` managed process when included in this deployment, or a Render background worker launcher calling exported tick functions. Use a bounded batch loop that polls again only after previous work completes. Use a separate minute-level reconciliation schedule. Timers provide polling only: all jobs, leases, frozen payloads, webhook receipts and attempt history live in PostgreSQL, so container restarts require no disk. Configure platform restart-on-failure and independent web/worker scale; no HTTP request completion runs the queue.

CAS leases last 90 seconds; provider send aborts after 15 seconds. Worker retries use bounded exponential backoff plus jitter, at most eight processing attempts. Successful dispatch and channel creation are one transaction. Stale leases are reclaimable. An attempt ledger records started/accepted/retryable/permanent/ambiguous outcomes; a started record may mean a worker died after the provider accepted. Dead-letter rows remain visible for staff review.

Resend retains idempotency for 24 hours, with keys at most 256 characters; changing a key or payload can create a second send. The worker freezes the complete provider request encrypted before first attempt and reuses `bizopt-{notificationId}`. It stops automatically at 23 hours, or after exhausted ambiguous attempts, in `reconciliation_required`. Never automatically reset that row with a new key. Inspect provider logs/request IDs, correlated receipts and domain state; record a deliberate operator decision before any separate replacement notice. A proven permanent rejection goes to dead_letter. [Provider idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys) also distinguishes concurrent requests from payload conflicts.

Provider quotas/rate limits depend on the configured account and plan. Inspect the dashboard and response limits before scaling; this repository does not infer an account's quota or guarantee throughput. Rate-limited sends back off with the same frozen request/key. Start with one send worker, then scale only within verified provider limits. A reconciliation lookup never sends a replacement email.

## Delivery, suppression and privacy

`accepted` means the provider accepted the API request; only a delivery event gives delivered. Monotonic processing never changes delivered back to accepted/delayed or complaint/bounce back to a successful state. Signed receipt JSON stores message ID, event status/time and hashed recipient identifiers only, omitting subject, address, click data and provider error text. Unique provider/event IDs deduplicate callbacks. A receipt arriving before the acceptance write remains pending with bounded delayed correlation retries; after 32 attempts or seven days it becomes unmatched for review. Processing failures have eight bounded attempts before dead_letter.

Permanent bounce, complaint and provider suppression populate EmailSuppression. No necessary-message exception bypasses suppression. Do not clear suppression automatically or repeatedly resend; require verified address correction/provider review. Users retain a safe in-app recovery/support notice. Keep support workflows private and MFA protected. Optional emails have category-bound, expiring unsubscribe proofs; opening their confirmation link does nothing until explicit POST. Necessary security/billing preferences cannot be disabled; marketing delivery is unavailable.

Outbox proof ciphertext is cleared after successful dispatch. Email proof/frozen request ciphertext is cleared after provider acceptance, cancellation/expiry/terminal handling, and independently by expiry cleanup. Sensitive original expiry always caps retention. Non-sensitive frozen requests expire within 24 hours. Ciphertext is never loaded for the metadata dashboard. Database backups, provider retention and application-log retention still need the organization's separate reviewed retention policy; deleting a live row does not erase an existing backup or provider record. Rotate keys only after draining/expiring active envelopes, or deliberately invalidate outstanding proofs; no silent fallback keyring exists.

## Development and staging verification

`EMAIL_PROVIDER=fake` creates a durable encrypted fixture mailbox in PostgreSQL, uses no network and accepts only recipients ending in `.test`. It refuses production. `getFakeMailPreview(messageId)` is a guarded local helper for fixture inspection, never an unauthenticated production endpoint. Static previews under docs contain no real proof/unsubscribe token. Fixture mailbox ciphertext expires after 24 hours and reconciliation purges it. Do not use real addresses as development fixtures.

Run unit tests with `npx vitest run tests/services/notifications tests/services/automation/events.test.ts`. Real database tests opt in only when both AUTOMATION_TEST_DATABASE_URL and DATABASE_URL equal `postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test`; apply migrations to that disposable local fixture first. The suite tests rollback, concurrent semantic/channel dedupe, provider acceptance crash recovery, callback correlation, suppression and ciphertext retention. An omitted database URL skips those tests and is not evidence of database correctness.

Staging operator sequence: verify DNS and configured identities; run the fake full registration/reset/billing flows first; send only to explicitly authorized staging recipients; confirm plaintext and HTML/links/expiry; confirm provider delivered webhook and duplicate retry; simulate hard bounce/complaint in provider test tools; verify suppression and in-app recovery; kill/restart send worker around acceptance; verify repeated frozen payload/key; test invalid signatures without logging bodies; verify privacy/tenant staff access. Review Stripe receipt settings separately: Stripe owns payment receipts if enabled, BizOpt owns normalized product status. Do not label both product notifications and provider receipts as independent charges.

## Metrics and alert wiring

The MFA-protected staff route exposes counts by status/channel, provider attempt outcomes, accepted vs delivered counts/rates, bounce/complaint observations, oldest due outbox age, dead letters, reconciliation-required count and mean enqueue-to-acceptance latency from the latest 1,000 accepted rows. Observed lifecycle intent counts are not cohort conversion or reset-completion rates. Stripe reconciliation drift, cohort introductory conversion, reset-specific completion and invalid-signature rate require the corresponding billing/cohort/HTTP-log metric sources; they are explicitly unavailable from this delivery helper.

Configure external alerts before rollout: oldest due outbox over five minutes, sustained provider failures/rate limits, growing dead letters or reconciliation-required rows, unmatched callbacks, bounce/complaint change from baseline, invalid-signature HTTP/log spikes and billing reconciliation drift from the billing worker. Thresholds are starting operator settings, not automatic policy changes. The webhook logs only the static `email_webhook_signature_invalid` event; count it in the deployment log pipeline. No alert destination or monitoring service is silently provisioned.

## Remaining production gates

No real customer email, DNS mutation or production migration was performed. Production remains gated on owned-domain/SPF/DKIM/DMARC evidence; sender/reply/support configuration; independently generated keys and rotation/backup retention review; deployed and restarted workers; verified webhook routing; account-specific provider quotas; alert destinations and dashboards; authorized staging mailbox/device/auth journeys; actual live/test-mode provider delivery evidence; and the billing/consent/refund policy gates in the billing runbook. Static previews and fake acceptance do not demonstrate inbox placement or provider delivery.
