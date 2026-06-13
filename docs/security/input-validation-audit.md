# Input Validation and Injection Audit

Audit date: 2026-06-13

## Vulnerable spots found and fixed

1. `app/api/campaigns/[id]/carousel/[slideId]/route.ts`
   - **Issue:** Accepted partial JSON body without schema validation.
   - **Fix:** Added Zod schema with constraints for `caption`, `mediaAssetId`, and `sortOrder`, plus non-empty payload enforcement.

2. `app/api/growth/predict/route.ts`
   - **Issue:** Accepted unvalidated payload for `briefId` / `campaignId`.
   - **Fix:** Added Zod schema validation and structured 400 responses on invalid input.

3. `app/api/media/[id]/route.ts`
   - **Issue:** Accepted unbounded numeric metadata update payload.
   - **Fix:** Added Zod schema with numeric bounds for `width`, `height`, and `durationMs`, plus non-empty payload enforcement.

4. `app/api/media/audio-layers/[layerId]/route.ts`
   - **Issue:** Accepted unvalidated audio layer mutation payload.
   - **Fix:** Added Zod schema with bounds for `startMs`, `volume`, and `sortOrder`, plus non-empty payload enforcement.

## SQL injection / unsafe query audit

- No unsafe raw SQL execution patterns were found.
- Database access remains through Prisma ORM models.

## User-generated content rendering audit

- No direct raw HTML rendering APIs were found in UI code.
- React escaped rendering is used for user-provided text output paths.
