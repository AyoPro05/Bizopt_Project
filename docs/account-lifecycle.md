# Account lifecycle

BizOpt continues to use NextAuth 4 credentials/JWT authentication with the existing bcrypt hashes and server-revocable browser/mobile sessions. These flows do not create a second authentication system. NextAuth's adapter `VerificationToken` table remains unchanged for compatibility; custom lifecycle actions never read it.

## Registration and verification

`POST /api/auth/signup` accepts strict JSON `{ name, email, password, orgName?, callbackUrl? }`. Account, settings, owner membership/workspace, pending subscription, inactive entitlement, hashed identity proof and encrypted transactional outbox intent commit in one serializable transaction. A missing encryption key or trusted app origin fails before account creation. Email delivery happens only in the independent worker after commit. The UI says the email is queued; provider acceptance/delivery are separate states.

Signup sends one acknowledgment with a verification link. `/check-email` offers resend and normal sign-in, preserving the selected billing callback. The existing three free preview ideas remain unchanged. Email verification never changes the subscription or entitlement. Successful verification emits `identity.verified` using `welcome:<userId>` as the welcome dedupe key.

`POST /api/auth/verification/request` accepts `{ email, callbackUrl? }`. Both eligible and ineligible addresses receive the same generic 202 response, including cooled-down/rate-limited addresses. The visible cooldown is 60 seconds; server limits are durable and apply across web instances/restarts. A new proof consumes all prior active verification proofs for that user.

`POST /api/auth/verification/confirm` accepts `{ id, token }`. The legacy `GET /api/auth/verify-email?token=...` performs no DB operation, drops the old proof and redirects to `/verify-email?legacy=1`. Existing raw adapter proofs cannot verify identities or activate access. Affected users request a replacement email; they do not need another account.

## Password recovery

`POST /api/auth/password-reset/request` accepts `{ email, callbackUrl? }`. The response is always 202 with:

> If an eligible account exists, we’ll send password reset instructions.

Eligible means an existing password-based account. Missing addresses, OAuth-only users and throttled requests receive identical response content, status and Retry-After header. All take the same minimum 500 ms response path; ordinary DB/queue load can still add latency, so this is timing mitigation rather than a constant-time network guarantee. No password is silently created for an OAuth account. An authorized provider-based account should use its sign-in provider's recovery settings.

`POST /api/auth/password-reset/confirm` accepts `{ id, token, password, confirmPassword }`. It hashes using bcrypt cost 12, consumes the proof with compare-and-set, updates the password, increments `User.sessionVersion`, revokes all WebSession/MobileSession/SupportAccessGrant records, deletes adapter sessions, invalidates every outstanding identity proof, and writes `password.changed` audit plus `identity.password_changed` outbox event in the same transaction. The security event is deduped by audit ID. Recovery never signs the user in; ordinary sign-in is required.

Passwords have at least eight characters and at most 72 UTF-8 bytes to avoid bcrypt truncation. Confirmation must match. Current-password input still accepts legacy credentials up to the original 100-character limit for reauthentication.

## Authenticated account changes

`components/auth/account-security-form.tsx` exports `AccountSecurityForm({ emailVerified, email? })`. Unverified users receive verification resend controls. Verified password-based users can request either action:

| Route | Strict JSON input | Result |
| --- | --- | --- |
| `POST /api/account/password` | `{ currentPassword, password, confirmPassword }` | Verify current password, change password, revoke all sessions, audit and queue security notice atomically; require sign-in. |
| `POST /api/account/email/request` | `{ currentPassword, email }` | Verify current password and current verified identity; queue proof to new unclaimed email. Current email stays active. |
| `POST /api/account/email/confirm` | `{ id, token }` | Require the same authenticated, verified user; confirm target ownership, replace email, keep it verified, revoke all sessions/proofs, audit and queue notice to old email atomically. |

These APIs use the existing `getPlatformContext` and mutation guard, plus a strict Origin check against `APP_URL`. A random Authorization header cannot bypass Origin/CSRF checks on public proof routes or security routes. OAuth-only users receive provider guidance without password creation. Email uniqueness failures use a generic message and never identify the owner of another address. Simultaneous claims are also constrained by the existing unique User.email index.

For email change, the user must stay signed in to the requesting account. If their session has expired, they sign in and reopen the original email link; the proof is deliberately not persisted through the sign-in redirect.

## Proof and delivery security

Identity proofs contain 32 random bytes and are stored only as SHA-256 lookup hashes. The record binds user, purpose and intended address. Proof consumption rechecks all bindings, expiry and unconsumed state inside the transaction and claims with compare-and-set. Per-user PostgreSQL advisory locks and serializable retries serialize issuance/resends/consumption. Concurrent submissions can commit only one successful consumption.

Email URLs use only configured trusted `APP_URL`, never request Host. Actual proof material appears only in the URL fragment. Token pages remove the fragment (and obsolete query proof fields) into React memory on mount; GET/page load never consumes it. There is no localStorage/sessionStorage token persistence. Refreshing a page after the fragment is removed requires reopening the email. Confirmation requires explicit POST. Pages and responses set no-referrer/no-store/noindex; root instrumentation suppresses telemetry and restricts third-party connections on these pages.

The outbox stores raw proof material only in a short-lived AES-GCM envelope via `emitEvent`; public payloads contain safe scalar facts and a validated internal callback destination. Passwords never enter events, audit metadata, API responses or application logs. In-app notifications and staff metadata contain no proof link or raw token. Email delivery checks whether a proof is obsolete before sending. Old-address email-change notices use the explicit approved old recipient instead of resolving the newly updated account address.

## Limits and configuration

| Setting / limit | Value |
| --- | --- |
| `APP_URL` | Required exact trusted origin; HTTPS in production. Development HTTP is restricted to localhost/127.0.0.1. |
| `NOTIFICATION_PAYLOAD_KEY` | Required canonical base64 encoding of 32 random bytes; shared securely with web and notification workers. |
| `IDENTITY_VERIFICATION_TTL_MINUTES` | Integer 1–1440; default 1440 (24 hours). Also bounds pending email changes. |
| `IDENTITY_RESET_TTL_MINUTES` | Integer 1–120; default 30. |
| Public verification/reset sends | 30/IP/hour, 5/email/hour, 1/email/minute, per purpose. |
| Proof confirmations | 30/IP/10 minutes and 10/proof ID/10 minutes, per purpose. |
| Authenticated security actions | 5/user/15 minutes and 30/IP/hour. |
| Signup | 5/IP/hour. |
| Request body | 1024 bytes for public email requests; 4096 bytes for signup/proof/account security bodies. |

Rate counters use hashed keys and durable `IdentityRateLimit` rows. Public IP budget is checked before creating attacker-selected email/proof buckets. Production proxy configuration must overwrite client-supplied forwarding headers so existing `clientIp()` is trustworthy. Expired rate buckets can be pruned after their longest one-hour window; consumed/expired proof retention and encrypted delivery envelope purging follow the operational retention policy. Do not log request bodies, full URLs with legacy query proofs, or decrypted envelopes at a proxy/provider.

Delivery credentials, sender/domain/DNS, reply/support URLs and the independent dispatcher/delivery workers must be configured according to the notification runbook. Registration can commit while a provider is unavailable because encrypted intent remains durable. A missing encryption key intentionally blocks creation/identity changes rather than creating an account without recoverable notification intent. Keep old encryption keys available until active envelopes have expired when rotating; replacing the sole key without a migration cancels outstanding deliverable secrets and requires new requests.

## Verification

Run `npx vitest run tests/services/identity` for pure token/schema checks, transaction contract/CAS tests, request privacy/rate guards and actual React confirmation mount/SSR checks. These unit suites mock database storage and event append; the root disposable-PostgreSQL integration suite verifies actual rollback, unique constraints and concurrent transaction behavior. Test delivery uses the fake provider and fixture recipients. No production recipient sends or live credential inspection are part of this workflow.

Staging checks: register a fixture user, inspect one encrypted acknowledgment intent, confirm GET has no mutation, confirm POST verifies once, verify entitlement remains inactive, resend and reject the old link, recover with the newest link, verify all old browser/mobile/support sessions fail, then sign in normally. Request and confirm a new email while signed in; ensure old address stays current until confirmation and receives its security intent after the swap. Exercise missing, OAuth and cooldown reset requests and compare their public responses. Test the selected Base/Team billing callback across signup, email confirmation and sign-in.
