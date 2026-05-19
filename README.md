# BizOpt — AI content & social publishing

Premium SaaS for AI-generated content packs, multi-platform publishing, and Stripe subscriptions.

## Phases shipped (A–C)

- **A:** $0.99 / 7-day trial (payment method required) → $9.99/mo, webhook trial events, 1 device limit
- **B:** `/home` dashboard, Home in sidebar + top bar, light/dark/system theme in Settings, draft autosave API
- **C:** AI Studio generates **6 variants** per idea (caption, carousel, image/video/audio ideas, thread)

**Next:** D (media editor), E (carousel + platforms), F (Apple-ready `packages/core` extraction)

## Quick start

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_ID

npm install
npx prisma db push
npm run db:seed
npm run dev
```

## Stripe trial setup

1. Create a **$9.99/month** recurring Price → `STRIPE_PRICE_ID`
2. Optional: one-time **$0.99** Price → `STRIPE_TRIAL_FEE_PRICE_ID` (charged at checkout with subscription trial)
3. Webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

Checkout uses `payment_method_collection: always` and `trial_period_days: 7`.

## Key routes

| Route | Purpose |
|-------|---------|
| `/home` | Home dashboard + draft resume |
| `/ai-studio` | Multi-variant AI generation |
| `/settings` | Theme toggle |
| `/integrations` | Platform registry |
| `/billing` | Trial + subscription |

`/dashboard` redirects to `/home`.
