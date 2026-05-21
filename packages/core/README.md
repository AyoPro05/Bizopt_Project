# @bizopt/core

Shared, platform-agnostic contracts for BizOpt web and future Apple clients.

## Modules

| Export | Purpose |
|--------|---------|
| `PlatformConnector` | OAuth connect, token refresh, publish |
| `PlatformRegistryEntry` | Capability flags per network |
| `SubscriptionSnapshot` | Billing / entitlement shape |
| `MediaEditParams` | Trim, crop, reorder metadata |
| `CarouselSlideSnapshot` | Multi-slide post structure |

## Usage (web)

```ts
import type { PlatformConnector } from "@bizopt/core";
import { LinkedInConnector } from "@/services/platforms/linkedin";
```

## Apple / iOS

This package is **TypeScript-only** — it does not ship to Swift. For a native app:

1. Call the same JSON APIs as the web app (`app/api/*`).
2. Use these types as a reference when defining Swift models (or generate from OpenAPI later).
3. Keep OAuth and Stripe in thin iOS adapters; business rules stay in `services/*` on the server.

See `/docs/APPLE.md` in the repo root for the full App Store checklist.
