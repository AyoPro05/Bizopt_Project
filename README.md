# BizOpt — AI content & social publishing

Premium SaaS for AI-generated business post packs, multi-platform publishing, growth intelligence, compliance checks, and Stripe subscriptions.

## Shipped

- **Billing:** $0.99 / 7-day trial → $9.99/mo, webhooks, refunds, 1 device limit
- **AI Studio:** 3 free ideas, then trial — OpenAI or template fallback
- **Growth Intelligence:** scores, predictions, next-best actions (`/growth-intelligence`)
- **Compliance Center:** pass/warn/fail checks, remediation (`/compliance-center`)
- **Media:** private storage, authenticated file URLs
- **Campaigns:** builder, carousel, expandable platform registry (LinkedIn-first)
- **Security:** signed OAuth state, rate limits, webhook verification

## Documentation

See [`docs/`](./docs/README.md) for PRD, architecture, [Apple app readiness](./docs/APPLE.md), and [OpenAPI](./docs/openapi.yaml) (`GET /api/openapi`).

**Mobile:** `POST /api/auth/mobile/login` → use `Authorization: Bearer` on API calls.

## Quick start

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET, DEVICE_SECRET, STRIPE_*

npm install
npx prisma db push
npm run db:seed
npm run dev
```

If pages look unstyled or you see `Cannot find module './XXXX.js'` in the terminal, clear the dev cache and restart:

```bash
npm run dev:clean
```

## Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Sentry setup (client + server)

1. Create a Next.js project in Sentry and copy your DSN.
2. Set env vars in `.env`:

```bash
SENTRY_DSN="https://<key>@o<org>.ingest.sentry.io/<project>"
NEXT_PUBLIC_SENTRY_DSN="$SENTRY_DSN"
SENTRY_ENVIRONMENT="development"
```

3. Restart dev server (`npm run dev`).
4. Trigger a test server error:

```bash
curl -i http://localhost:3000/api/debug-sentry
```

5. Trigger a test message:

```bash
curl -X POST http://localhost:3000/api/debug-sentry
```

6. Verify in Sentry Issues/Events dashboard.

## Project layout

| Path | Role |
|------|------|
| `app/(app)/` | Authenticated UI (`/home`, AI Studio, campaigns, …) |
| `app/api/` | JSON API for web and future mobile clients |
| `services/` | Domain logic |
| `packages/core/` | Shared TypeScript contracts (`@bizopt/core`) |
| `workers/` | Background jobs |

## Key routes

| Route | Purpose |
|-------|---------|
| `/home` | Dashboard hub |
| `/ai-studio` | Multi-variant generation |
| `/growth-intelligence` | Growth scores & predictions |
| `/compliance-center` | Startup compliance checks |
| `/integrations` | Platform connectors |
| `/billing` | Trial + subscription |
