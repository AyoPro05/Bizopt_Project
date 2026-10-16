# Platform account and workspace experience

This additive delivery keeps the existing application, SEO workflows, design tokens, authentication provider, billing routes, integrations and published release history.

## Interface capability decisions

| Capability | Existing implementation | Verified behaviour / gap | Action | Priority |
| --- | --- | --- | --- | --- |
| Navigation | Shared desktop and mobile navigation | Closed mobile drawer previously left focusable links in the document | Native modal navigation, keyboard dismissal and focus restoration | Improve, P0 |
| Account identity | Authentication existed without a complete account menu | Plan, membership and permissions require authoritative account data | In-memory account provider and accessible identity/workspace menu | Implement, P0 |
| Workspace switching | Multiple memberships supported by the data model | Switching must not expose old workspace state | Server-authorised switch, clear account client caches, full document navigation | Implement, P0 |
| Profile and settings | Theme, integrations and release notes | No comprehensive session or privacy controls | Profile editing, active browser/mobile sessions, password-confirmed revocation, preferences, privacy requests | Improve, P0 |
| Workspace membership | Organisation membership and roles | Invitation and removal operations need explicit confirmation | Real member list, role actions, ownership transfer and version-aware mutations | Implement, P0 |
| Invitations | New invitation API/service | Preview, capacity and actual delivery must agree | Recipient/role/reservation preview, explicit confirmation, delivery history, revoke/resend confirmation | Implement, P0 |
| Invitation acceptance | Credentials authentication and signup | Secret-bearing links must avoid queries and browser storage | Fragment-only proof, remove fragment before fetch, keep proof in memory, inline sign-in, matching verified email enforced server-side | Implement, P0 |
| Help and support | Routes added by the support delivery | Staff and customer permissions differ | Account links to Help, Support, contextual issue reporting and conditional staff console | Integrate, P0/P1 |
| Native apps/referrals | No approved distribution or rewards configured | Menu entries would imply unavailable functionality | Omit until real approved programmes/releases exist | Defer, P2 |

## Data, approvals and recovery

The account provider keeps account data in React memory and uses `cache: "no-store"`. It does not persist workspace data in browser storage. Logout clears `bizopt:` and `bizopt-draft` storage entries plus BizOptz-named Cache Storage entries before the existing NextAuth sign-out flow. Workspace switching clears the same caches and loads a new document. A generation check prevents an earlier account response from restoring cleared account state.

Local draft recovery is opt-in, defaults to off, and should remain off on shared devices. Disabling it removes local SEO/draft recovery copies. Other editors must independently respect the persisted preference before storing content locally.

Privacy actions create durable private requests for review. The interface does not promise immediate data export, immediate deletion or immediate backup erasure. It explains ownership transfer, workspace-owned data, billing review and retention considerations. Final legal retention/deletion requirements and operational fulfilment need documented policy.

Invitations are reviewed before confirmation. Pending invitations reserve capacity until expiry or revocation. Acceptance never constitutes billing consent. Invitation proof is accepted only from the URL fragment, immediately removed from the address bar, held in memory and sent in a POST body. Refreshing or closing the acceptance page requires reopening the original invitation email. Signup opens the existing signup flow in a new tab so the current invitation can remain in memory; email verification uses the existing provider flow.

Member removal copy explains that access ends immediately while workspace-owned work is retained and the selected subscription price is unchanged. Ownership transfer requires the current password. UI permission checks reflect the authoritative role/capability response; every mutation still requires server-side authorisation.

## Responsive and accessibility implementation

- Shared shell uses minimum width zero, dynamic viewport height and safe-area padding.
- Navigation and primary account/workspace controls use 44 CSS px minimum targets.
- Mobile navigation uses native `<dialog>` for background inertness, focus containment and Escape behaviour. Closed drawer controls are not focusable.
- Account menu supports arrow/Home/End navigation, Escape, outside-pointer dismissal and trigger focus restoration. On small screens it becomes a native modal.
- Profile/session/privacy/member/invitation actions expose loading, error, empty and confirmation states.
- Workspace membership uses wrapping rows rather than a page-wide table.
- Theme reuses the existing light/dark/system provider and existing reduced-motion styles.
- No user-agent-dependent app download promises are made.

These are implementation details, not a WCAG certification or a claim that every browser/device was tested.

## Verification status

See [PLATFORM_VERIFICATION.md](PLATFORM_VERIFICATION.md) for the final integrated type, lint, unit, database, build and browser results, screenshots and release limits. No real invitations, customer charges, production releases or data exports were performed.
