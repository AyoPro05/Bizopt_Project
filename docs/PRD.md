# BizOpt PRD (implementation reference)

Multi-tenant SaaS for AI content creation, social publishing, **Growth Intelligence**, and **Compliance Intelligence**.

## Pricing

- $0.99 / 7-day trial (payment method required at signup)
- $9.99/month recurring after trial
- Stripe webhooks are source of truth for entitlements
- One active device per subscription

## Navigation

- **Home** hub: `/home` (always reachable via topbar Home button)
- Growth: `/growth-intelligence`
- Compliance: `/compliance-center`

## Intelligence layers

### Growth Intelligence

- Growth score and business health on Home
- Predictions with explainable labels and recommended formats
- Next-best actions and metric snapshots
- APIs: `GET /api/growth/snapshot`, `POST /api/growth/predict`, `GET /api/growth/recommendations`

### Compliance Intelligence

- Pass / warn / fail checks with remediation
- Findings, risk events, audit logs on run
- Seeded rules in `prisma/seed.ts`
- APIs: `POST /api/compliance/run-checks`, `GET /api/compliance/findings`, `GET /api/compliance/rules`

## Schema notes (vs generic PRD paste)

This repo uses `OrgMember`, `Asset`, `Entitlement`, `/home` (not `/dashboard`), and private media at `/api/media/[id]/file`. Extend incrementally rather than renaming wholesale.

## Build phases

See project build plan: Foundation → Data → Billing → Dashboard → AI Studio → Media → Campaigns → Growth → Compliance → Polish.
