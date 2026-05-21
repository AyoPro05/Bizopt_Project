# BizOpt architecture

## Layers

```
app/(marketing|auth|app)     →  UI (React Server Components + client islands)
app/api/*                    →  HTTP API (thin handlers)
services/*                   →  Domain logic (billing, ai, growth, compliance, publishing)
lib/*                        →  Auth, DB, validators, device, platform sync
packages/core (@bizopt/core) →  Shared TypeScript contracts (platforms, media, billing shapes)
prisma/                      →  PostgreSQL multi-tenant schema (orgId on tenant tables)
workers/                     →  Background jobs (publish, webhooks, growth, compliance)
```

## Multi-tenancy

- Users belong to orgs via `OrgMember`.
- Subscription and entitlements are **org-scoped**; Stripe webhooks update `Entitlement`.
- Home hub: `/home` (not `/dashboard`).

## Publishing

Single entry: `services/platforms/publish.ts` → `getPlatformConnector()` (LinkedIn, Instagram, Facebook, TikTok).

Legacy `services/integrations` re-exports publish for backward compatibility.

## Platform accounts

Two tables stay in sync via `lib/platform-accounts.ts`:

| Model | Used by |
|-------|---------|
| `SocialAccount` | OAuth callback, publish tokens |
| `PlatformAccount` | Integrations UI, growth/compliance counts |

OAuth connect writes both; disconnect clears both.

## Mobile auth

- JWT access tokens (15 min) via `lib/mobile-auth.ts`
- Refresh tokens stored hashed in `MobileSession`
- `getApiContext` accepts session cookies **or** `Authorization: Bearer`

## Intelligence

- **Growth:** `services/growth/scoring.ts` → `/api/growth/*`, Home + `/growth-intelligence`
- **Compliance:** `services/compliance/checks.ts` → `/api/compliance/*`, Home + `/compliance-center`

## Apple / mobile (future)

See [APPLE.md](./APPLE.md). Native clients should call `app/api/*` only; do not depend on NextAuth cookies without a token exchange layer.
