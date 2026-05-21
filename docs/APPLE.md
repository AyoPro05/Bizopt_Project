# Apple app path

## Can BizOpt become an App Store app?

**Yes, with additional work.** The backend is structured so a native client can share the same API and database. The repo does **not** yet include an iOS/Xcode or React Native project.

| Ready today | Needed for App Store |
|-------------|----------------------|
| JSON APIs under `/api/*` | Mobile auth (Bearer tokens or Sign in with Apple), not cookie-only NextAuth |
| Device binding headers (`x-device-fingerprint`, etc.) | ASWebAuthenticationSession / universal links for OAuth |
| `packages/core` TypeScript contracts | OpenAPI spec or Swift models generated from API |
| Stripe web billing | Decide: Stripe in WebView vs StoreKit for in-app purchases (Apple rules) |
| Private media URLs with session | iOS upload pipeline + background tasks |
| Multi-tenant org model | Push notifications, offline drafts (optional) |

## Mobile auth (shipped)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/mobile/login` | Email/password → `accessToken` + `refreshToken` |
| `POST /api/auth/mobile/refresh` | Rotate access token |
| `POST /api/auth/mobile/logout` | Revoke refresh session |
| `GET /api/auth/mobile/me` | Profile + org + entitlement |

Send `Authorization: Bearer <accessToken>` on all protected APIs. Same device headers as web for paid routes.

## OpenAPI / Swift codegen

- Spec file: [`openapi.yaml`](./openapi.yaml)
- Live URL: `GET /api/openapi` (YAML)

```bash
# Example: generate Swift client (requires openapi-generator CLI)
openapi-generator generate -i https://your-app.com/api/openapi -g swift5 -o ./BizOptAPI
```

## Recommended approach

1. **Phase A — API client (SwiftUI or React Native)**  
   Use mobile login + OpenAPI-generated client for campaigns, AI, growth, compliance, devices.

2. **Phase B — OAuth**  
   Replace browser-only `/api/social/connect` redirects with a mobile callback URL and token exchange endpoint.

3. **Phase C — Store**  
   TestFlight → App Store review. If subscription is sold **inside** the iOS app, comply with IAP rules or keep purchase on web only.

## What not to do

- Do not embed the Next.js web app in a WebView and call it “native” for full feature parity.
- Do not duplicate business rules in Swift; keep scoring/compliance in `services/*` on the server.

## Extraction map

| Web today | Apple client |
|-----------|----------------|
| `services/growth/*` | `GET/POST /api/growth/*` |
| `services/compliance/*` | `POST /api/compliance/run-checks` |
| `lib/platform-accounts.ts` | `GET /api/platforms/registry` + connect APIs |
| `@bizopt/core` types | Reference for Swift structs (manual or OpenAPI codegen) |
