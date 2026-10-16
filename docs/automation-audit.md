# Lifecycle automation repository audit

Audited 15 October 2026 at feature commit `918f7d9`. Preserve existing SEO, AI Studio, publishing, tenant permissions, themes and the approved **one active device per person** policy (reconfirmed for this brief).

## Stack and reusable boundaries

Next.js 15.5.18 App Router, React 19.2.6, Prisma/PostgreSQL 6.19.3, NextAuth 4.24.14 credentials/JWT with Prisma adapter, bcryptjs, Stripe SDK 17.7.0 pinned to API `2025-02-24.acacia`, Resend SDK 6.12.4 and Vitest 4.1.10. Resolve precise versions from package-lock.json, not package.json ranges. Existing browser/mobile sessions have server revocation and current membership checks; preserve these instead of adding authentication.

Existing domain services live under services/, thin HTTP routes under app/api/, one-tick workers under workers/. PostgreSQL queues already back Stripe events, SEO audit jobs and invitations. There is no installed Redis/BullMQ, Redis deployment or Render blueprint. A PostgreSQL outbox plus leased notification rows is the equivalent durable queue; do not add an unnecessary broker. Worker processes must run independently and repeatedly, with no reliance on request completion or filesystem persistence.

## Findings

| Area | Evidence | Gap and action |
| --- | --- | --- |
| Registration | app/api/auth/signup/route.ts | Unverified user creation exists but account/token/outbox are separate writes; inline Resend call. Replace with one transaction and encrypted short-lived delivery envelope. |
| Verification | app/api/auth/verify-email/route.ts; VerificationToken | Raw token lookup, consumption on GET, non-atomic writes, and inappropriate entitlement change. Credentials auth has no provider-owned recovery flow. Preserve adapter table; add purpose-bound hashed IdentityToken, explicit confirmation POST and obsolete-link resend flow. Verification must never activate paid access. |
| Passwords | lib/auth.ts, services/account/sessions.ts | bcrypt and revocation reusable; no reset or authenticated change flow. Add bound expiring tokens, atomic password/revocation/security event/outbox; normal sign-in after reset. |
| Email | lib/email.ts | Inline sends, hardcoded resend.dev sender, unescaped user name, unsupported free/unlimited claims, no text alternatives or delivery ledger. Replace call sites with versioned transactional templates and configured sender/reply/support URLs. |
| Outbox/delivery | Existing invitation delivery and Stripe inbox | Per-feature queues exist; no central notification policy, semantic dedupe, provider delivery webhook, suppression or preferences. Add modular outbox/notification services using existing DB stack. |
| Checkout | services/billing/checkout.ts | Server price IDs, fixed Base/Team and idempotency exist. Intro fee is optional, consent is not persisted, and local dates are fabricated on checkout creation. Require verified identity, explicit versioned consent and actual provider fee configuration. Do not create/change price objects. |
| Entitlements | services/billing/plan-changes.ts | Trialing alone grants access. Gate new introductory checkouts on the related paid non-zero fee invoice, validated price, customer and local intent. Preserve existing legitimate access through explicit legacy rules. |
| Stripe | Existing verified route, inbox and advisory lock | Signature verification, unique event ID, bounded retry/dead-letter and current provider subscription retrieval exist. Route still processes inline, invoice purpose not recorded, async/refund/dispute coverage incomplete. Extend existing records and normalized lifecycle mapping. |
| Refunds | services/billing/refunds.ts; constants.ts | Hardcoded seven-day window and campaign-use rule lack commercial approval in this brief; charge.refunded revokes access unconditionally, pending status misclassified on updates. Require configured reviewed policy; requests can enter private support review. Separate status and subscription cancellation. |
| Device security | services/devices/index.ts | Per-person restrictions and rebind transaction exist. Emit event in successful rebind transaction; do not invent suspicious-login risk signals. |
| Publishing/jobs | services/publishing/index.ts, AI/media workers | Real failure states exist; AI worker merely marks pending jobs processing and has no trustworthy long-running completion. Notify only from actual persisted outcomes; identify incomplete engines as unavailable. |
| UI/operations | Existing account, billing and privileged support UI | Reuse tokens/dialogs and staff MFA. Add account confirmation/recovery pages, private notification center/preferences/history and metadata-only privileged delivery dashboard. No email token in notification links or previews. |
| Tests/migrations | Vitest, SQL additions, local PostgreSQL/Chrome suites | Extend opt-in disposable DB tests and fake provider contracts. Keep migrations additive; production application/migrations/email/DNS changes require operator setup. |

## Approved rules and external evidence

Base: USD 99 minor units for seven days, then USD 999 monthly until canceled, with payment method and explicit recurring consent. Team stays the already-approved fixed 140% Base recurring subtotal and five-person capacity; show plan-specific amounts truthfully. Preserve three free AI preview ideas separately. Retain one active device per person. Optional 24-hour reminder is disabled. Growth/compliance messages require trustworthy existing evidence and user-confirmed deadlines; no invented predictions/certifications.

Provider behavior checked against installed SDK types and primary sources: [Stripe subscription trials](https://docs.stripe.com/billing/subscriptions/trials), [Checkout creation](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-02-24.acacia), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Resend webhook verification](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests), [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Resend idempotency expires after 24 hours: ambiguous delivery must stop for reconciliation before that boundary, not blindly create a new send. Provider acceptance is distinct from delivery.

## Production blockers at audit time

No verified sending domain/DNS evidence, sender/reply/support configuration, sensitive-envelope key, live/test provider validation, price/portal review, Render deployment or external alert destination has been verified. Do not inspect or mutate live customers as tests. Live test-clock and staging delivery checks require configured test credentials. No automatic public release or production migration is authorized by this implementation brief.
