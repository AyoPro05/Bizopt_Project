# Help and support

The platform adds `/help`, `/support` and `/support-console`. Support is durable internal intake in PostgreSQL. A signed-in member can submit a report, search their own conversations, read customer-visible replies, send further details and reopen a resolved or closed report. Workspace ownership does not grant access to other members' reports or to privileged support tooling.

## Capabilities and boundaries

| Capability | Implementation | Verification and operational boundary |
| --- | --- | --- |
| Help Center | Five versioned release-reviewed guides; local search and deterministic cited guidance | Grounded in existing SEO documentation and the confirmed platform rules. No external AI call, ticket retrieval, private account diagnosis or action execution. Review the versioned content with every release. |
| Issue reporting | Categories, subject, description, suggested severity, workflow, reproduction, diagnostics consent, email preference and timestamps | `/support?report=1&workflow=/seo` provides contextual intake. UUID request identity prevents duplicate creation on retry. Intake limited to ten reports per identity per hour. |
| Conversations | Own `orgId` and `userId` required on every lookup and mutation; server-side public-message projection | Replies use optimistic versions and thirty replies per identity per hour. Conflicts preserve the typed draft and require refresh. Reports and replies are stored server-side, not in browser storage. |
| Private security reporting | `/support?security=1`; `security` category enforced on the server | Only the reporter and separately enrolled support administrators can read it. An ordinary support agent cannot list/read it or be assigned to it. |
| Support console | Metadata-first queue, explicitly opened private content, staff notes, assignments and validated status transitions | Separate database staff membership plus password and RFC 6238 TOTP step-up. Agents see unassigned/own non-security reports; administrators see all reports. No impersonation, workspace-content browsing, billing override or external sending. |
| Notifications | Email preference can be recorded; all replies are available in the app | No support email adapter or durable notification worker is configured. The UI and API explicitly report delivery unavailable. No SLA or human staffing hours are invented. |
| Attachments | Unavailable | No upload endpoint or screenshot/recording capture. Add type validation, size limits, scanning/quarantine, tenant-authorised short-lived download and retention before enabling. |
| Privacy requests | Durable human-review intake | Intake is not execution of export, deletion, identity verification or a legal response guarantee. |

Apply the root platform additive migration and regenerate Prisma before enabling these routes. No production migration or live staff enrollment is performed by this implementation.

## Permissions and data handling

All support routes use the central authenticated platform context and server capability checks. User-facing report access requires the active workspace and the same reporting identity, including for workspace owners and admins. User ticket projections filter `internal: false` in the database and replace author IDs with `fromSupport`. The user API never includes staff notes, assignees, staff credentials or MFA secrets.

`SupportStaff.role` accepts `support_agent` or `support_admin` for authorization. Unknown values and inactive records deny access. Support agents may assign a scoped report to themselves or unassign it. Support administrators may additionally assign through the API to another active staff identity; security reports require an administrator assignee. The UI exposes self-assignment and unassignment without a directory of staff identities.

Every privileged API validates active staff membership, an unexpired hashed grant bound to the current server browser session, and an active browser session. Bearer/mobile contexts cannot unlock privileged support. The `support_access` cookie is HttpOnly, SameSite Strict, scoped to `/api/support/staff`, Secure in production and valid for ten minutes. Staff must enter the current account password and a six-digit authenticator code. Successful TOTP counters are consumed atomically to prevent reuse. Unlock attempts are durably counted in an audit table, with five attempts per identity per fifteen minutes. The user cannot enroll or grant themselves staff access.

Queue views, private ticket opening, public replies, internal notes, triage, unlock/lock and customer changes create audit records without message bodies or diagnostics. Private detail authorization and its durable audit complete before the private body is fetched. Updates use version checks and transactions, so a concurrent assignment or reply cannot silently overwrite another change. Application APIs append audit events; database privileges, immutable audit export and retention remain operator responsibilities.

Ticket statuses are `received`, `triaged`, `investigating`, `waiting_for_user`, `resolved`, `closed`. Staff must triage before moving into investigation/waiting/resolution. Resolved conversations can close or reopen; closed conversations reopen through triage. Customer replies to a waiting conversation return it to triage. Reopening requires a written explanation.

Diagnostics are collected in the browser only after opt-in and previewed before submission. The server drops all diagnostics when consent is false and otherwise admits only constrained app version, browser family/version, OS family, error identifier and a known static workflow route. Query values, fragments, unknown route segments, cookies, tokens, prompts and document content are discarded. The free-text description is user supplied: the form asks people to exclude secrets, but cannot guarantee they will do so. Staff handling, retention and incident procedures must account for that residual risk.

JSON payloads are bounded, mutation routes require the shared origin/CSRF guard, and private responses use `Cache-Control: private, no-store`. No HTML from a ticket is rendered as markup. Serializable request/reply throttles and optimistic updates are database-backed; configure infrastructure-level abuse limits as additional protection.

## Operator-managed staff enrollment

Set a server-only `SUPPORT_ENCRYPTION_KEY` containing a cryptographically random 32-byte value encoded as base64, supplied by the deployment secret manager. `encryptTotpSecret` uses AES-256-GCM with authenticated context and a fresh nonce. Never put the key or plaintext authenticator secret in Git, customer tickets, analytics, URLs or routine logs. Back up the key through the approved secrets process; losing it makes enrolled secrets unreadable.

Enrollment must be performed by an authorised deployment operator after separately verifying the staff identity and approving the least-privilege role. No self-service enrollment API exists. A controlled operator script can use this sequence (values come from the operator's secure provisioning channel):

```ts
import { db } from "./lib/db";
import { encryptTotpSecret, verifyTotp } from "./services/support/mfa";

const userId = process.env.ENROLL_SUPPORT_USER_ID!;
const role = process.env.ENROLL_SUPPORT_ROLE!;
if (!["support_agent", "support_admin"].includes(role)) throw new Error("Invalid staff role");
const user = await db.user.findUnique({ where: { id: userId } });
if (!user?.passwordHash || !user.emailVerified) throw new Error("Verify the staff identity and password account first");
// Provision at least 20 random bytes into an authenticator through an approved
// secure enrollment channel. The environment contains those same raw bytes as base64.
const secret = Buffer.from(process.env.ENROLL_SUPPORT_SECRET_BASE64!, "base64");
const counter = verifyTotp(secret, process.env.ENROLL_SUPPORT_TOTP_PROOF!);
if (counter === null) throw new Error("Authenticator enrollment proof failed");
await db.$transaction(async (tx) => {
  await tx.supportStaff.upsert({
    where: { userId },
    create: { userId, role, active: true, totpSecretEnc: encryptTotpSecret(secret), lastTotpCounter: counter },
    update: { role, active: true, totpSecretEnc: encryptTotpSecret(secret), lastTotpCounter: counter },
  });
  await tx.supportAccessGrant.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await tx.auditLog.create({ data: { userId, action: "support.operator_enrolled", entity: "SupportStaff", entityId: userId, metadata: { role } } });
});
await db.$disconnect();
```

This is an operational example, not an automatically executed installer. The operator must establish a secure authenticator provisioning channel and approval record; this repository does not claim either exists in production. Wait for the next code before the first console unlock because enrollment consumes the proof counter. Revoke a staff record by setting `active: false` and revoking its access grants; every subsequent privileged API denies it. Rotate the encryption key by decrypting/re-encrypting enrolled records under controlled maintenance and revoking grants. Retention of expired grants/unlock events needs an approved operational schedule; no destructive cleanup job is silently installed.

## Threat model and verification

The primary threats are cross-tenant/customer ticket access, workspace-admin escalation into support, private-note leakage, stolen/replayed staff grants, diagnostics exfiltration, unsolicited external AI processing, abuse and concurrent ticket overwrites. Controls above address these paths in application code. Transport HTTPS, database encryption/backups, secret management, employee onboarding/offboarding, immutable audit retention, support staffing, incident handling, privacy notices/subprocessors, legal retention and live restore tests require deployment/operational review.

`npm test -- tests/services/support` exercises RFC 6238 reference vectors, authenticated encryption/tampering, counter replay, durable MFA throttling, independent staff membership, grants tied to live browser sessions, diagnostics exclusion, input-field rejection, documentation retrieval/escalation, tenant/user selectors, public-message author redaction, duplicate intake, optimistic conflicts, reopening, durable reply limits, metadata queue scopes, audit-before-private-content access and security assignment denial. These tests use the real validation/crypto/services with mocked database boundaries; they are not a claim of live production enrollment, email delivery or completed browser accessibility certification. Root platform verification records shared database/browser checks.

The next support slice is approved notification delivery with durable idempotent jobs and preferences, an operator-approved retention/access policy, controlled staff provisioning UX, and optional external ticketing adapters. External AI processing of private ticket content remains unavailable pending disclosure and processing controls.
