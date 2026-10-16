# Access, signup and dependency hardening

The user approved the first priority in `docs/APP_AUDIT_2026-10-16.md`: fix access controls, signup and vulnerable dependencies, and require database/security regressions in CI. Implement in the existing feature checkout; preserve the audit report and unrelated work. No deployment, production database mutation or external mail/payment/publishing is part of this change.

## Design

Workspace editor sessions are personal resumable state within a workspace, matching their existing listing selector. Authorize the current member and scope every session read/write to organization and person before mutation. HTTP input must be a bounded strict editor schema, never arbitrary Prisma update input. Validate selected content/assets against the same organization. Save stage snapshots and the corresponding update in one transaction. Snapshot restore/history must also bind the snapshot to its authorized session.

Retain NextAuth, Prisma 6 and the current identity transaction semantics. Replace only the unsupported advisory-lock result with the supported scalar-returning query already used by billing. Verify the existing registration, verification, recovery and session-revocation integration tests against PostgreSQL.

Stay on the current framework/auth major versions. Raise minimum direct versions to patched releases and use narrow overrides only for upstream-pinned vulnerable transitive packages, with CLI/build/runtime smoke checks for compatibility.

CI must start a disposable PostgreSQL instance at the existing exact loopback test URL, build its empty schema, apply SQL-only security protections from the actual migration sources, and run every test with no skips. Run suites serially to avoid unrelated cross-suite serialization conflicts. Add a required production dependency audit. Correct the invalid deployment step key and make deploy depend on the checks. Branch-protection settings in GitHub cannot be established solely by a workflow file.

## Execution

- [x] Reproduce the identity failure with the real PostgreSQL lifecycle suite (red).
- [x] Add workspace route/database regressions: unauthorized and cross-person access, no writes/snapshots on denial, input/nested relation rejection, foreign content references, atomic stage snapshots, authorized edits and snapshot binding (red).
- [x] Add strict workspace schemas and scoped transactional services; update their HTTP routes and existing unit callers (green).
- [x] Fix identity lock and verify registration/recovery/verification, including the real HTTP signup handler (green).
- [x] Update patched dependencies and lockfile; inspect residual audit results and justify/test narrow overrides.
- [x] Add disposable-database initialization and a CI runner that fails on missing test configuration or skipped tests; wire PostgreSQL and audit into CI.
- [x] Run all database-enabled tests, lint, typecheck, production audit and build; smoke signup and patched image runtime locally using fixture accounts only.
- [x] Review the diff independently, resolve findings and document exact verification plus any external branch-protection step.

Outcome and remaining deployment/settings prerequisites: [security hardening report](../../SECURITY_HARDENING_2026-10-16.md).
