# Billing lifecycle operations

The approved web offer is **$0.99 today for 7 days, then $9.99/month until canceled** for Base (two people, including the owner). Team remains the approved fixed 140% recurring subtotal: $13.99/month for five people. Both introductory fees are $0.99 USD. Applicable tax and final totals are displayed by Stripe before payment and recorded on the provider invoice. Three free AI preview ideas remain a separate allowance. The existing **one active device per person** policy is unchanged.

## Installed provider contract

Stripe SDK 17.7.0 uses API `2025-02-24.acacia`. This implementation deliberately uses the parameters supported by those installed types: subscription-mode Checkout, one recurring monthly price with quantity one, a mandatory one-time fee on the initial invoice, `trial_period_days: 7`, card collection `always`, and missing-method end behavior `cancel`. Subscription-mode Checkout retains the payment method for recurring billing. A completed redirect or a standalone PaymentIntent never grants access. Subscription `trialing` alone never grants access.

Primary sources verified on 15 October 2026:

- [Versioned Checkout create reference](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-02-24.acacia): one-time prices in subscription mode apply only to the initial invoice; recurring billing and payment-method collection use subscription mode.
- [Legacy trial-period configuration](https://docs.stripe.com/billing/subscriptions/trials/free-trials): delay recurring billing using subscription trial settings; provider trial dates are authoritative.
- [Subscription webhook behavior](https://docs.stripe.com/billing/subscriptions/webhooks): reconcile lifecycle transitions using provider invoice and subscription state.
- [Refund lifecycle](https://docs.stripe.com/refunds): pending and requires-action refunds are distinct from success, and refunds can fail.

Stripe's current default [Trial Offer API documentation](https://docs.stripe.com/billing/subscriptions/trials) describes a newer API requiring `2026-09-30.endive` and different eligibility/Checkout restrictions. It is not used or silently enabled here. Any SDK/API upgrade requires a separate review and staging fixtures.

## Required configuration and live blockers

Set placeholders in the environment; never commit credentials or create price objects from application startup.

| Setting | Required behavior |
| --- | --- |
| `APP_URL` | Trusted application origin for billing links and redirects. |
| `STRIPE_SECRET_KEY` | Environment-specific test/live credential. Fixtures never contact a customer account. |
| `STRIPE_MONTHLY_PRICE_ID` | Active USD 999 fixed monthly per-unit licensed Base price. Legacy `STRIPE_PRICE_ID` fallback is supported. |
| `STRIPE_TEAM_PRICE_ID` | Active USD 1399 fixed monthly per-unit licensed Team price, quantity one. |
| `STRIPE_INTRODUCTORY_PRICE_ID` | Active USD 99 one-time fee. Legacy `STRIPE_TRIAL_FEE_PRICE_ID` fallback is supported. Missing configuration blocks checkout; it never changes the offer to free. |
| `STRIPE_WEBHOOK_SECRET_TEST`, `STRIPE_WEBHOOK_SECRET_LIVE` | Keep secrets separate per environment. Legacy `STRIPE_WEBHOOK_SECRET` works within one environment. The handler selects by secret-key prefix and rejects a verified event with the wrong `livemode`. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Reviewed active portal configuration with provider subscription updates disabled so it cannot bypass plan quotes. Payment methods/invoices remain available. |
| `BILLING_GRACE_PERIOD_DAYS` | Existing policy defaults to three days. Must be integer 0–30. Grace is anchored to a confirmed paid-through date, never webhook receipt or retry time. Zero keeps the valid paid period and adds no extra grace. |
| `BILLING_AUTO_REFUND_POLICY_VERSION`, `BILLING_AUTO_REFUND_WINDOW_DAYS` | Both absent by default. Enable only after commercial/consumer-rights review of a named policy and its window. No implicit seven-day or campaign-usage rule remains. |
| `DATABASE_URL` | Shared PostgreSQL inbox/outbox/notification storage. |

No live/test credentials, verified price configuration, provider portal configuration, tax configuration, branded email domain/DNS, support destination, deployment, external alert destination, or real Stripe test-clock run has been verified by local fixture tests. There were **no real customer/account/price API calls or emails** during implementation. These are production blockers, not successful setup claims.

The versioned commercial checkbox binds the actor, workspace, plan, integer minor amounts, seven-day duration, currency, offer version, terms version, renewal-disclosure version and server acceptance time. Consent is committed before a provider create call so a timeout cannot erase the accepted terms. Checkout/portal/refund/plan/cancel/resume mutations require current billing capability, a verified email, origin/CSRF checks and rate limits where applicable. Existing upgrade quotes, proration approval and downgrade capacity rules are preserved.

## Durable processing and reconciliation

The webhook verifies the raw body, stores a unique StripeEvent and acknowledges only durable acceptance. It performs no synchronous subscription processing or email sends. Run the existing inbox worker independently; it leases rows, retries with bounded exponential backoff and records exhausted attempts as dead letters. Never replay an exhausted job against live state until reviewed.

Run `npx tsx workers/billing-reconciliation-worker.ts` repeatedly through the independently deployed worker scheduler (at least every minute). Each tick checks at most 20 known subscriptions, with a 15-minute minimum interval per attempted subscription. A durable `lastReconciliationAttemptAt` gives failing tenants a fair retry position; `lastReconciledAt` records successful reconciliation. There is no filesystem cursor or in-request timer. Scale tick throughput for the tenant count; alert if oldest due reconciliation exceeds the target interval.

Reconciliation takes a workspace advisory lock, retrieves current provider subscription and invoice state, and commits payment rows, entitlement and domain-event intent together. Complete invoice line collections are fetched. Histories beyond the bounded 5,000-invoice review ceiling fail closed for operator review. A late failed event cannot overwrite a currently paid invoice; a superseded subscription cannot replace the checkout currently bound to the workspace. A PaymentIntent added after invoice creation updates the existing invoice row.

Introductory evidence requires the related subscription/customer, server commercial consent and matching one-time introductory price on the initial invoice. Access additionally requires a settled nonzero invoice and valid current subscription. Monthly purpose uses the approved recurring price, subscription relation, non-prorated cycle and a positive service-line net amount; classification does not compare the invoice total to $9.99. Zero-value invoices and unrelated extra payments do not activate monthly access. Prorations remain adjustments and use existing plan-change controls.

Existing paid subscriptions acquire evidence from real provider invoice history. Legacy trialing records without a paid, consent-bound initial fee do not gain introductory access. Review inconsistent legacy accounts explicitly instead of inventing payment evidence.

## Normalized events and send-time guards

| Domain event | Semantic identity / current-state requirement |
| --- | --- |
| `billing.introductory_active` | Subscription + introductory invoice + current owner; only paid introductory access. |
| `billing.introductory_ending` | Subscription + actual trial end + current owner; approximately three days before conversion. |
| `billing.monthly_active`, `billing.renewed`, `billing.payment_recovered` | One common `recurring-paid:{subscription}:{invoice}:{owner}` identity, so the same invoice cannot cause both recovery and activation/renewal notices. |
| `billing.payment_failed`, `billing.authentication_required` | Invoice + notice kind + current owner; current Payment must still carry the matching failure/action status at dispatch and send. |
| `billing.cancellation_scheduled`, `billing.resumed` | Current provider cancellation transition, remaining actual access date and current owner. |
| `billing.ended` | Ended provider subscription + owner; no fabricated end at checkout. |
| `billing.refund_pending`, `billing.refunded`, `billing.refund_failed` | Provider refund + status + owner; current local refund status must still agree. |
| `billing.dispute` | Actual current disputed payment requiring response/review + dispute status + active support administrator. Internal recipients only; no automatic ban. |

Core notification guards run at dispatch **and** send. Billing recipients must still own the workspace. Introductory-ending notices additionally require the same provider subscription, paid introductory evidence, matching future `periodEnd` within three days, no conversion and no scheduled cancellation. Failure/action notices carry `invoiceId`; refund notices carry `refundReference`. A stale notice is suppressed, rather than sent after recovery/conversion/refund completion. A scheduled provider `trial_will_end` event and reconciliation fallback use the same reminder key. The optional 24-hour reminder remains off.

Payment failure preserves any confirmed paid period. Configured grace never grows from duplicates. Recovery and first recurring activation are mutually exclusive for an invoice. Cancellation defaults to period end and requires an explicit confirmation; resuming requires a supported future cancellation and provider confirmation. Immediate cancellation is not exposed to customer self-service. Cancellation never implies a refund.

## Refund review and disputes

Without explicit reviewed automatic policy configuration, a refund request writes `review_requested` plus an audit entry and returns that real status to the customer. Support must review these durable Refund rows through its approved workflow; requesting review does not promise acceptance, submission or settlement. The billing page shows real refund status and keeps a support link available. Applicable mandatory consumer rights require support review and are not defeated by an automated eligibility answer.

If a reviewed automatic policy is configured, the service records approval/audit before submission and reuses `refund:{localRefundId}` for provider idempotency. An ambiguous result older than 23 hours stops for review rather than blindly replaying after the provider's idempotency retention boundary. `pending`/`requires_action` stay pending; only provider `succeeded` produces `billing.refunded`; canceled/failed produces `billing.refund_failed`. Pending snapshots are re-fetched under the workspace lock. A refund never cancels a subscription or revokes entitlement without a separately approved access policy. Disputes notify active internal support administrators only and preserve audit/evidence without permanent bans.

## Receipt responsibility

Stripe owns monetary receipts, tax invoice details and hosted payment authentication. Operators must review Stripe Dashboard receipt/refund-email settings and any provider trial-compliance reminders for the actual account and jurisdiction. BizOpt owns product-status notices, actual access/renewal dates, recovery/cancellation state and its billing-history links. BizOpt notifications are not a second tax receipt. Before activation, review Stripe-managed receipts/reminders to avoid redundant messages while retaining necessary status notices. No blanket receipt-delivery claim is made merely because Stripe accepted a charge.

## Safe staging verification

1. Apply additive migrations to an isolated staging database and deploy web/inbox/outbox/notification/reconciliation workers independently. Keep test and live credentials/secrets separate; never run production migrations as a fixture.
2. Configure existing test-mode Base/Team/introductory price IDs and reviewed portal/tax settings. Validate USD 999/1399 monthly and USD 99 one-time amounts without creating prices automatically.
3. With an explicitly configured Stripe **test** account/test clock, exercise introductory payment, zero/unpaid initial invoice, first recurring payment, renewal, card failure, authentication, recovery, cancel-before-conversion, resume and refund pending/succeeded/failed. No test-clock call runs by default.
4. Replay different event IDs for the same logical payment and deliver stale failed events after payment success. Confirm one normalized paid notice, stable payment status, no stale reminder/failure mail and no duplicate grace extension.
5. Stop email delivery/queue workers, commit a provider transition, then restart workers. Confirm committed intent survives and payment state remains independent from email delivery.
6. Review dead letters, signature failures, reconciliation failures/drift, overdue billing checks, conversion counts and notification suppression. Configure alerts to an actual operator destination before production.

Local fixture verification: billing tests cover consent/configuration/verification gates, invoice relationships, zero/unpaid evidence, introductory/monthly/renewal/recovery classification, duplicate/out-of-order events, same-invoice row identity, reminders/cancellation/resume, refund pending/success, disputes and durable asynchronous webhook acceptance. Repository typecheck and scoped ESLint must pass; broader integration results are recorded in the final implementation report.
