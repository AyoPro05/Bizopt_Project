# CLAUDE.md — BizOpt

## Project Overview

BizOpt is an AI content & social publishing SaaS for startups and small businesses. It provides AI-generated content ideas, multi-platform publishing, growth intelligence, and compliance checks.

## Skill Routing

When the user's request matches an available skill, invoke it. Key routing rules:

| Request | Skill |
|---------|-------|
| Product ideas, brainstorming new features | `/office-hours` |
| Challenge scope, rethink direction | `/plan-ceo-review` |
| Architecture review, data flow | `/plan-eng-review` |
| UI/UX plan review | `/plan-design-review` |
| Full review pipeline (plan + design + eng + DX) | `/autoplan` |
| Bugs, unexpected behavior | `/investigate` |
| QA testing, find bugs | `/qa` or `/qa-only` |
| Code review, diff check | `/review` |
| Visual polish, consistency | `/design-review` |
| Deploy, merge, PR | `/ship` |
| Save progress | `/context-save` |

## Branch Discipline

`main` is always deployable. Every change goes through a feature branch + PR.

```bash
git checkout -b feat/my-feature
# ... work ...
git add .
git commit -m "feat: my feature description"
git push origin feat/my-feature
# Then open PR via GitHub
```

## Quality Gates (CI enforces these on every PR)

1. `npm run lint` — zero ESLint errors (TypeScript strict mode)
2. `npm run test` — all tests pass
3. `npm run build` — clean production build

## Deployment

- **Platform:** Vercel (auto-deploy on merge to `main`)
- **Preview:** Every PR gets a Vercel preview URL
- **Production:** Merges to `main` deploy automatically after CI passes
- **Staging:** Vercel preview environments serve as staging

### Required Environment Variables (set in Vercel project settings)

```
DATABASE_URL         — PostgreSQL connection string
NEXTAUTH_SECRET      — NextAuth secret
DEVICE_SECRET        — Device fingerprinting secret
NEXT_PUBLIC_APP_URL  — Production URL
STRIPE_SECRET_KEY    — Stripe secret key
STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret
STRIPE_PRICE_ID      — Price ID for subscription
OPENAI_API_KEY       — AI generation (optional; template fallback exists)
SENTRY_DSN           — Error monitoring
SENTRY_ORG           — Sentry organization
SENTRY_PROJECT       — Sentry project name
SENTRY_AUTH_TOKEN    — Sentry deployment auth token
```

## Architecture Principles

**Services must be browser-agnostic** — no React/Next.js imports allowed in `services/*`. This keeps them reusable for a future iOS app (see `docs/APPLE.md`). All platform/API logic lives in `services/`; `app/api/*` are thin handlers that validate input → call service → return JSON.

**Platform account dual-write** — `SocialAccount` (publish tokens) and `PlatformAccount` (UI counts) are kept in sync via `lib/platform-accounts.ts`. Always write to both when connecting; always set `disconnectedAt` when disconnecting.

**Stripe webhooks are the source of truth** for entitlements. Never trust client-side state — always check `db.entitlement` for `active` or `userFacingState`.

**OAuth state must be signed** — use `createOAuthState()` / `verifyOAuthState()` from `lib/oauth-state.ts`. Never pass raw org/user IDs in OAuth redirects.

## Key Routes

| Route | Purpose |
|-------|---------|
| `/home` | Dashboard hub |
| `/ai-studio` | Multi-variant generation |
| `/growth-intelligence` | Growth scores & predictions |
| `/compliance-center` | Startup compliance checks |
| `/integrations` | Platform connectors |
| `/billing` | Trial + subscription |

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

Tests live in `tests/`. Pure utility functions (slugify, date utils) are unit-tested without a database. Service functions that touch the database use `vi.mock` for `db`.

### Dev testing pattern: Demo OAuth

Social platform connection (TikTok, Instagram, LinkedIn) can be tested locally without real OAuth credentials. In development mode (`NODE_ENV=development`) or when `ALLOW_DEMO_OAUTH=true`, `GET /api/social/connect?platform=tiktok` redirects to `/api/social/callback` with `code=demo_connected`, creating a fake-but-functional platform account in both `SocialAccount` and `PlatformAccount` tables.

## Services Architecture

```
services/      → Business logic (no React/Next.js imports)
app/api/*      → Thin HTTP handlers (validate input → call service → return JSON)
lib/*          → Auth, DB, validators, device, platform sync utilities
workers/       → Background jobs (publish, webhooks, growth, compliance, AI, media)
packages/core/  → Shared TypeScript contracts (@bizopt/core)
```

## Development Workflow

```bash
# Local setup
npm install
npx prisma db push   # or db:push if schema changed
npm run db:seed      # seed platform registry + compliance rules
npm run dev          # starts Next.js dev server on :3000

# Workers (run as needed)
npm run worker:webhook
npm run worker:publish
npm run worker:growth
npm run worker:compliance

# Stripe webhooks (local)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Database studio
npm run db:studio
```
