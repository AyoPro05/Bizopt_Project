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

## Apple extraction

Move pure logic from `services/platforms/*` into this package; keep HTTP/OAuth env access in thin host adapters on iOS.
