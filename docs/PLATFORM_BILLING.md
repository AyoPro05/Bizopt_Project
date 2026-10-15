# Platform billing: Base and Team

Implemented using the existing Stripe SDK/API version (`2025-02-24.acacia`), subscription records, entitlements, webhook inbox and reconciler. This is implementation and fixture verification; no live customer, price, subscription, schedule or charge was inspected or changed.

## Commercial model

- Base: 2 people total including the owner, at the existing base monthly subtotal and currency.
- Team: 5 people total including the owner, at one fixed 140% of Base. Occupancy never changes its recurring price. No per-person surcharges or plans beyond 5 exist.
- Integer minor-unit arithmetic uses round half up: `(B * 140 + 50) / 100` with integer division. The default 999 minor units gives Team 1399, not 1398.60 or a separately rounded seat price.
- Approved device policy: one active device **per person**. Workspace seats and per-person device limits are separate. The billing code never changes device limits to the workspace seat count.
- Trial duration/fee settings use the existing configuration. The existing optional trial-fee price is validated when set; when absent, the UI truthfully shows no upfront fee. Trial plan changes, overdue upgrades, interval changes, discounted subscriptions, multi-item subscriptions and existing conflicting schedules are blocked for policy review.

## Selection, approval and payment

The pricing page and billing screen show both plans before first checkout. A same-plan open checkout is reused. Alternative open checkout sessions are expired under a workspace PostgreSQL advisory lock. An existing local or provider subscription prevents another checkout. Customer and checkout creation use idempotency keys. Selected plan metadata includes capacity, currency and fixed recurring subtotal. A redirect grants no access.

Configured provider prices must match amount, currency, one-month interval, quantity 1, licensed fixed per-unit billing and active status. An unknown or mismatched price cannot grant Team seats. Checkout retains Base capacity until verified provider confirmation; the existing confirmed trial state remains supported.

A paid Base-to-Team upgrade previews both the provider's immediate prorated invoice and its next-renewal invoice. The UI separates line adjustments, tax, discount, upfront amount, recurring subtotal, next invoice total and renewal time (shown explicitly in Europe/London). Approval binds the actor/workspace, subscription, original preview, source/target prices, item, provider state, local version, proration timestamp, complete invoice totals and lines. Quotes expire in 5 minutes and are re-previewed before execution. Changed values require new approval.

The update uses `payment_behavior=pending_if_incomplete`, `proration_behavior=always_invoice`, the approved `proration_date`, quantity 1 and `billing_cycle_anchor=unchanged`. Successful provider payment confirmation enables Team immediately; no renewal wait. Pending authentication/declines retain Base and return the same hosted invoice to finish payment. Retrying the same approval reuses its provider idempotency key; after ambiguous network results a new approval cannot create a second charge. An expired unpaid pending update requires a new quote.

A Team-to-Base downgrade reserves the future capacity ceiling transactionally before contacting Stripe. Active members plus unexpired pending invitations must fit within 2 seats. Provider schedule phases retain Team through the paid period and apply Base at renewal with `proration_behavior=none`; no downgrade credit/refund is generated. Future invitations use the lower pending ceiling. Members are never removed automatically. Explicit removal affects access immediately. Cancellation releases the provider schedule and verifies released state and continuing Team before clearing the local reservation, without a new subscription/upgrade charge.

## Authoritative state and recovery

Verified webhook handling resolves ownership by the stored Stripe customer, takes a per-workspace database advisory lock, then retrieves the current provider subscription. It never replays old event subscription objects as entitlement truth. Invoice events reconcile current provider state, so an old paid invoice cannot activate an overdue subscription. The transaction validates configured price/quantity and changes plan/seat entitlements together. Duplicate deliveries repeat the same reconciliation. Existing renewal grace is not extended by duplicate failure events.

Unexpected downgrade capacity conflicts suspend paid access, persist actual provider plan/capacity, record `reconciliation_required`, log an operational error and show an owner/admin billing warning. Membership is retained. The durable webhook inbox retries pending/failed events, reclaims abandoned three-minute leases and stops after five attempts in `dead_letter`. Operators must resolve the conflict and verify provider state before resetting an exhausted delivery. Operations must monitor failed webhook records and `billing_plan_reconciliation_conflict` / `billing.owner_attention_required` audit events; this code does not claim an external on-call alert integration is configured.

## Configuration and rollout

Apply the additive platform migration and regenerate Prisma before enabling the UI. Required existing configuration remains `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `SUBSCRIPTION_AMOUNT_CENTS`, `BILLING_CURRENCY`, trial settings and app origin. Set `STRIPE_TEAM_PRICE_ID` to an **already reviewed** fixed monthly price matching integer 140% of the configured Base amount and the same currency/tax behavior. This implementation does not create price objects.

Configure `STRIPE_PORTAL_CONFIGURATION_ID` for a reviewed active portal with subscription updates disabled. Runtime inspection rejects an unsafe portal, preventing unreviewed provider-side plan changes. Payment methods and invoices remain available through the safe portal configuration. Cancellation/refund behavior follows the existing policies.

Subscribe the existing verified webhook endpoint to checkout completion, subscription create/update/delete and pending-update applied/expired, invoice payment succeeded/failed/action-required, payment-intent succeeded and charge refunded. Run the existing webhook reconciler and monitor failed records. Run invitation workers/configuration separately; pending unexpired invitations reserve seats and acceptance never initiates a charge.

Before production enablement, verify configured prices/tax behavior, trial fee price, restricted portal, renewal/downgrade/cancellation and payment-authentication scenarios using dedicated Stripe test-mode fixtures, then an approved staged rollout. No live verification or production readiness is claimed by unit tests. Single-process rate limits are a supplementary control; multi-instance production deployment needs the shared abuse controls described in the platform handoff.

## Verification

`npm test -- tests/services/billing`: 30 fixture tests across fixed plan math/validation, exact checkout metadata, duplicate subscription protection, unsafe portal rejection, proration approval changes/expiry, payment pending access, schedule/cancellation provider contracts, capacity checks, renewal conflicts, immutable quote scope and authoritative webhook behavior.

`npx eslint services/billing lib/stripe.ts lib/validators.ts components/billing 'app/(app)/billing/page.tsx' 'app/(marketing)/pricing/page.tsx' app/api/stripe/checkout/route.ts app/api/billing/plan/route.ts tests/services/billing`: run as the targeted lint gate. Root performs final repository type/build/browser verification after parallel schema generation completes. Database transaction behavior is implemented with PostgreSQL advisory/serializable primitives; mocked tests verify invocation and state boundaries, not physical concurrent database execution.

Provider references: [Pending updates](https://docs.stripe.com/billing/subscriptions/pending-updates), [Invoice preview, pinned API version](https://docs.stripe.com/api/invoices/create_preview?api-version=2025-02-24.acacia), [Subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules).

Final integrated checks are recorded in [PLATFORM_VERIFICATION.md](PLATFORM_VERIFICATION.md).
