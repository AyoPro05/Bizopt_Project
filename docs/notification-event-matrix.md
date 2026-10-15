# Notification event matrix

All events use schema/template version 1 and locale `en`. The domain write and `emitEvent(tx, input)` commit together. One semantic key creates one outbox row; dispatch creates separate `:EMAIL` and `:IN_APP` rows with unique keys. Provider acceptance is distinct from delivery. The provider send key is `bizopt-{notificationId}` and is never changed on retry.

Security and billing channels are necessary. Operational and digest channels default off independently. Marketing is unavailable; no marketing events or automatic weekly digest scheduler are implemented. Optional email links open an explicit unsubscribe confirmation; GET does not change a preference. Every category respects hard-bounce/complaint suppression.

| Event | Category | Safe in-app destination | Trigger / semantic identity |
| --- | --- | --- | --- |
| identity.verification_requested | SECURITY | /verify-email | New hashed verification proof; one acknowledgment and verification email |
| identity.verified | SECURITY | /home | Atomic verification consumption; `welcome:{userId}`; never activates paid access |
| identity.password_reset_requested | SECURITY | /forgot-password | Eligible account, new purpose-bound proof |
| identity.password_changed | SECURITY | /forgot-password | Password/revocation/audit transaction; audit ID |
| identity.email_change_requested | SECURITY | /settings | New-address proof; explicit recipient override |
| identity.email_changed | SECURITY | /help | Successful change; notice goes to the former address |
| account.deletion_requested | SECURITY | /help | Private support request; no deletion success claimed |
| account.deletion_completed | SECURITY | /help | Template available; emitter unavailable until reviewed deletion policy exists |
| account.export_requested | SECURITY | /settings | User-only account export job requested |
| account.export_ready | SECURITY | /settings | Ready encrypted export; recheck owner identity, membership and expiry at dispatch/send |
| device.rebind_requested | SECURITY | /devices | Explicit actual device rebind operation UUID |
| device.rebound | SECURITY | /devices | Successful persisted rebind; same operation UUID, distinct event |
| billing.introductory_active | BILLING | /billing | Nonzero intended introductory invoice confirmed paid |
| billing.introductory_ending | BILLING | /billing | Same subscription/period end, paid intro, future within 3 days, not canceled/converted |
| billing.monthly_active | BILLING | /billing | First actual recurring invoice, never zero-value/trial invoice |
| billing.renewed | BILLING | /billing | Later paid recurring invoice; invoice semantic key |
| billing.payment_failed | BILLING | /billing | Invoice remains failed at dispatch/send |
| billing.authentication_required | BILLING | /billing | Invoice remains authentication-required at dispatch/send |
| billing.payment_recovered | BILLING | /billing | Reconciled actual recovery; avoid double activation for same transition |
| billing.cancellation_scheduled | BILLING | /billing | Persisted period-end cancellation |
| billing.resumed | BILLING | /billing | Persisted removal of scheduled cancellation |
| billing.ended | BILLING | /billing | Actual access ended |
| billing.refund_pending | BILLING | /billing | Local refund remains refund_pending |
| billing.refunded | BILLING | /billing | Local refund remains confirmed refunded |
| billing.refund_failed | BILLING | /billing | Local refund remains refund_failed |
| billing.dispute | BILLING | /support-console | Active support_admin recipient only; internal review |
| publishing.failed | OPERATIONAL | /calendar | Actual persisted publishing failure |
| publishing.missed | OPERATIONAL | /calendar | Reconciled actual missed schedule; no automatic success assumption |
| publishing.exhausted | OPERATIONAL | /calendar | Repeated actual failures; no invented retry engine |
| connection.reconnect_required | OPERATIONAL | /integrations | Actual persisted disconnected/expired connection |
| generation.ready | OPERATIONAL | /ai-studio | Template available; emit only from an implemented persisted completion engine |
| generation.failed | OPERATIONAL | /ai-studio | Template available; emit only from actual terminal persisted failure |
| usage.limit_reached | OPERATIONAL | /billing | Recorded quota threshold; aggregate/period semantic key |

No suspicious-login event, growth prediction, legal certification, invented deadline or generation completion is inferred. Template availability does not mean its domain engine exists. The optional 24-hour introductory reminder is not scheduled.

Ordinary org events require current recipient membership again when dispatching and sending. Billing and operational notices require current owner role, except internal disputes which require active support_admin. This prevents queued messages from reaching former owners. Reminder/payment/refund guards cancel superseded notices.

Public event JSON contains reviewed scalar facts only: plan, integer minor amounts/currency, actual ISO dates, safe provider invoice URL, invoice/refund references, sanitized platform/error codes and internal callback. Unrecognized data is discarded. Named token/password/secret/card/bank fields are rejected. Provider error text is never persisted.

Identity proof `{id,token}` is AES-256-GCM encrypted with a separate 32-byte key and event context. It is copied only into the email row, expires with the original proof and is checked against the live purpose-bound IdentityToken before sending. Proof links use trusted APP_URL and fragments; an optional safe callback appears in the query without proof data. In-app metadata is static and contains neither proof links nor recipient overrides. Expired/suppressed essential mail leaves the safe in-app recovery notice visible.

Email details use actual payload amounts/dates, plain text plus escaped HTML, configured sender/reply/support and no unlimited/free-trial claims. Hosted invoice links are limited to Stripe-owned invoice/checkout/payment domains. A future store provider can emit normalized lifecycle events without placing its raw object in the event. Apple purchase policy remains a separate reviewed integration.

Static fake previews: [index](email-template-previews/index.html). They contain no proof token, unsubscribe proof or customer data. Regenerate with `npx tsx docs/email-template-previews/generate.ts`.
