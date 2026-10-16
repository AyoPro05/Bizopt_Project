# Platform experience implementation plan

**Goal:** Complete an account → authorised invitation → workspace → issue report → staff response journey while preserving current content and SEO workflows.

**Architecture:** Extend the existing Next.js/Prisma/NextAuth/Stripe app with central permissions, revocable sessions, fixed Base/Team plans, transactional seat reservations, durable invitation delivery and tenant-scoped support. Reuse semantic tokens, native accessible dialogs and existing editor persistence. External writes are exercised only with fixtures.

**Design decision:** A shell-only redesign would leave the reported security and collaboration gaps. A full platform rewrite would discard working services. Extend the current shell and fill the end-to-end security and support paths, with feature flags for configured mail, billing prices and privileged staff MFA. The supplied brief authorises implementation without another design gate.

## Capability audit

| Capability | Existing evidence | Verified behavior / gap | Action | Priority |
| --- | --- | --- | --- | --- |
| SEO | Prior 174-test suite, `/seo` services and UI | Import-first workflow; live provider features deferred | Preserve + regression test | P0 |
| Responsive shell | Desktop sidebar + mobile drawer | Hidden drawer can retain focus; account menu missing | Improve | P0 |
| Authentication | NextAuth credentials/JWT + mobile tokens | Browser JWTs have no server revocation; access tokens not bound to mobile sessions | Improve | P0 |
| Tenant selection | Primary membership chosen each request | Membership reads scoped; no explicit switch or central capability model | Improve | P0 |
| Billing | Stripe checkout + verified webhooks | One plan only; requested/effective seats not distinguished | Implement fixed plans and safe provider contracts | P0 |
| Device policy | `DEVICE_LIMIT_DEFAULT=1`, org-scoped Device | One device for entire subscription conflicts with teamwork | Approved: one active device per person | P0 |
| Invitations/members | OrgMember exists | No invitation workflow or transactional seat reservations | Implement | P0 |
| Account privacy | Static settings paragraph | No sessions/profile/preferences/request intake | Implement | P0 |
| Support/help | No ticket models or support routes | No durable intake or staff/customer message separation | Implement | P0 |
| Staff privilege | No support role or MFA | Workspace admin cannot be treated as support staff | Implement separate staff + MFA grant; manual enrollment | P0 |
| AI guidance | Existing social AI service | No approved documentation retrieval; private support processing basis undefined | Implement approved help search; defer external support AI | P1 |
| Distribution/referrals | Responsive web only | No approved native apps or rewards | Hide unavailable actions; defer | P2 |

## Work

- [x] Add additive models for sessions, approvals/invitations, plan changes and support; generate standalone migration and RLS.
- [x] Implement central permissions, server-side session revocation and fail-closed bearer validation with focused tests.
- [x] Implement preview/approval, hashed invitation tokens, matching verified identity and serializable seat reservations; durable mail delivery with bounded retries.
- [x] Implement Base/Team pricing, first-checkout choice, provider quotes/pending updates and renewal downgrades with fixture contracts.
- [x] Implement account/workspace UI, safe logout/cache handling, accessibility and mobile shell improvements.
- [x] Implement support/help intake, versioned replies, staff MFA console and diagnostics consent.
- [x] Validate migration on isolated PostgreSQL; test tenancy, concurrency, permissions and full browser journeys.
- [x] Run test/lint/type/build checks, capture screenshots, publish exact capability and compatibility limits.

## Boundaries

No live invitations, subscription/price mutations, customer charges, external AI processing of private tickets, production database changes, releases, native distribution or legal/compliance promises. Support requires separately enrolled staff and configured encryption. Undefined trial/discount/interval upgrade policies remain disabled. Device policy approved: one active device per person.
