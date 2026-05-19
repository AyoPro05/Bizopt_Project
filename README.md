# BizOpt — AI content & social publishing

Premium SaaS for AI-generated business post packs, multi-platform publishing, and Stripe subscriptions.

## Shipped

- **Billing:** $0.99 / 7-day trial → $9.99/mo, webhooks, refunds, 1 device limit (enforced on paid APIs)
- **AI Studio:** 3 free ideas, then trial — OpenAI when `OPENAI_API_KEY` is set, templates as fallback
- **Business brief:** goal, industry, audience, platforms
- **Media:** private storage, authenticated file URLs, MIME allowlist
- **Campaigns:** builder, carousel, platform registry
- **Security:** signed OAuth state, rate limits, campaign PATCH allowlist, webhook customer verification

## Quick start

```bash
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET, DEVICE_SECRET, STRIPE_*

npm install
npx prisma db push
npm run db:seed
npm run dev
```

## Stripe + webhooks

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Key routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing + hero |
| `/home` | Dashboard + recent ideas |
| `/ai-studio` | Multi-variant generation |
| `/campaigns/[id]/builder` | Campaign + carousel |
| `/assets` | Media library (private files) |
| `/billing` | Trial + subscription |
