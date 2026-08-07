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

## Services Architecture

```
services/      → Business logic (no React/Next.js imports)
app/api/*      → Thin HTTP handlers (validate input → call service → return JSON)
lib/*          → Auth, DB, validators, device, platform sync utilities
workers/       → Background jobs (publish, webhooks, growth, compliance, AI, media)
packages/core/  → Shared TypeScript contracts (@bizopt/core)
```

## Testing

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Coverage report
```

Tests live in `tests/`. Pure utility functions (slugify, date utils) are unit-tested without a database. Service functions that touch the database use `vi.mock` for `db`.
