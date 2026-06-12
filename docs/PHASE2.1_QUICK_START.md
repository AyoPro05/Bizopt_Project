# Phase 2.1 Quick Start Checklist

**Goal:** Build WorkspaceSession system in 1-2 weeks

**Timeline:** Start now → Complete by [Target Date]

---

## ✅ Pre-Implementation

### Code Review
- [ ] Read [REFACTOR_TO_AI_OS.md](./REFACTOR_TO_AI_OS.md) — Full architecture
- [ ] Review [PHASE2.1_SCHEMA_ADDITIONS.md](./PHASE2.1_SCHEMA_ADDITIONS.md) — Database design
- [ ] Review [COMPETITIVE_DIFFERENTIATION.md](./COMPETITIVE_DIFFERENTIATION.md) — Why this matters
- [ ] Discuss with team: Does this align with product vision?

### Database Prep
- [ ] Backup current database
- [ ] Create feature branch: `feat/phase2-workspace-session`
- [ ] Pull latest `main` branch

---

## 🗂️ Step 1: Update Prisma Schema

**Estimated Time:** 30 minutes

### Files to Modify
- [ ] Open `prisma/schema.prisma`

### Add New Models
- [ ] Copy all models from [PHASE2.1_SCHEMA_ADDITIONS.md](./PHASE2.1_SCHEMA_ADDITIONS.md)
- [ ] Paste into schema.prisma (after existing models)

### Update Existing Models
- [ ] Add `workspaceSessionId` to `ContentVariant`
- [ ] Add `confidence, reason, recommendedAction, evidence` to `GrowthPrediction`
- [ ] Add `explanation, recommendedFix, evidence` to `ComplianceCheck`
- [ ] Add relations to `Organization` and `User`

### Verify Schema Syntax
```bash
npx prisma format  # Auto-format schema
npm run db:generate  # Check for errors
```

---

## 🗄️ Step 2: Create Database Migration

**Estimated Time:** 15 minutes

```bash
cd BizOpt
npx prisma migrate dev --name add_workspace_sessions
```

The CLI will:
1. Generate migration file: `prisma/migrations/[timestamp]_add_workspace_sessions/migration.sql`
2. Apply migration to database
3. Update Prisma client

If migration fails:
- Check database connection
- Verify schema syntax (run `npx prisma format` again)
- Check for conflicts with existing migrations

---

## 💻 Step 3: Create Service Layer

**Estimated Time:** 2-3 hours

### Create Directory
```bash
mkdir -p services/workspace
```

### Create Files (Copy from [PHASE2.1_IMPLEMENTATION.md](./PHASE2.1_IMPLEMENTATION.md))

#### 3.1 `services/workspace/session.ts`
- [ ] Create file
- [ ] Copy complete session.ts code
- [ ] Verify imports: `@/lib/db`, `@prisma/client`

#### 3.2 `services/workspace/snapshots.ts`
- [ ] Create file
- [ ] Copy complete snapshots.ts code

#### 3.3 `services/workspace/decision-cards.ts`
- [ ] Create file
- [ ] Copy complete decision-cards.ts code
- [ ] Update imports to reference existing services: `@/services/growth/scoring`, `@/services/compliance/checks`

### Verify Services Compile
```bash
npm run lint
# Should show 0 errors
```

---

## 🌐 Step 4: Create API Routes

**Estimated Time:** 1.5 hours

### Create Directory Structure
```bash
mkdir -p app/api/workspace/{sessions,"{[id],[id]/resume,[id]/snapshot"}}
mkdir -p app/api/home
```

### Create Files (Copy from [PHASE2.1_IMPLEMENTATION.md](./PHASE2.1_IMPLEMENTATION.md))

#### 4.1 `app/api/workspace/sessions/route.ts`
- [ ] Create file
- [ ] Copy POST (create session) + GET (list resumable) functions

#### 4.2 `app/api/workspace/[id]/route.ts`
- [ ] Create file
- [ ] Copy GET (retrieve) + PATCH (update) functions

#### 4.3 `app/api/workspace/[id]/complete-stage/route.ts`
- [ ] Create file
- [ ] Copy POST (transition stage) function

#### 4.4 `app/api/home/decision-cards/route.ts`
- [ ] Create file
- [ ] Copy GET (retrieve cards) + POST (compute cards) functions

### Verify API Routes Compile
```bash
npm run lint
# Should show 0 errors
```

---

## ⚛️ Step 5: Create Client Context

**Estimated Time:** 1 hour

#### 5.1 Create `lib/workspace-state.ts`
- [ ] Create file
- [ ] Copy WorkspaceContext + WorkspaceProvider + useWorkspaceSession hook
- [ ] Verify imports

#### 5.2 Update `app/providers.tsx`
- [ ] Open file
- [ ] Wrap existing providers with `<WorkspaceProvider>`
- [ ] Import `WorkspaceProvider` from `@/lib/workspace-state`

```tsx
// Before
return (
  <SessionProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </SessionProvider>
);

// After
return (
  <SessionProvider>
    <WorkspaceProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </WorkspaceProvider>
  </SessionProvider>
);
```

---

## ✅ Step 6: Testing

**Estimated Time:** 2 hours

### Unit Tests
```bash
npm test services/workspace
```

- [ ] Test create workspace session
- [ ] Test update workspace session
- [ ] Test transition stage
- [ ] Test save/restore snapshot
- [ ] Test list resumable sessions

### API Route Tests
```bash
npm test app/api/workspace
```

- [ ] POST `/api/workspace/sessions` → creates session
- [ ] GET `/api/workspace/sessions` → lists resumable
- [ ] GET `/api/workspace/[id]` → retrieves session
- [ ] PATCH `/api/workspace/[id]` → updates session
- [ ] POST `/api/workspace/[id]/complete-stage` → transitions stage
- [ ] GET `/api/home/decision-cards` → gets cards
- [ ] POST `/api/home/decision-cards` → computes cards

### Manual Testing (Browser)

#### Test 1: Create Session
```bash
curl -X POST http://localhost:3000/api/workspace/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "ideaPrompt": "Test idea",
    "tone": "professional"
  }'
```
Expected: Returns session object with `id`, `orgId`, `stage: "idea"`

#### Test 2: Retrieve Session
```bash
curl http://localhost:3000/api/workspace/sessions/[SESSION_ID]
```
Expected: Returns full session with variants, snapshots

#### Test 3: Update Session
```bash
curl -X PATCH http://localhost:3000/api/workspace/sessions/[SESSION_ID] \
  -H "Content-Type: application/json" \
  -d '{"businessGoal": "awareness"}'
```
Expected: Returns updated session

#### Test 4: Get Home Cards
```bash
curl http://localhost:3000/api/home/decision-cards
```
Expected: Returns object with 5 card types

### Database Verification
```bash
npm run db:studio
# Open http://localhost:5555
# Verify:
# - WorkspaceSession table exists
# - WorkspaceSnapshot table exists
# - HomeDecisionCard table exists
# - WorkspaceAuditLog table exists
# - ContentVariant has workspaceSessionId column
# - GrowthPrediction has confidence, reason, recommendedAction, evidence columns
# - ComplianceCheck has explanation, recommendedFix, evidence columns
```

---

## 🚀 Step 7: Build & Deploy

**Estimated Time:** 30 minutes

### Local Build
```bash
npm run build
```
- [ ] Build completes without errors
- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors

### Verify Production Ready
```bash
npm start
# Test routes in browser
http://localhost:3000/api/workspace/sessions
http://localhost:3000/api/home/decision-cards
```

### Create Pull Request
- [ ] Push feature branch: `git push origin feat/phase2-workspace-session`
- [ ] Create PR on GitHub
- [ ] Provide summary:
  - New models: WorkspaceSession, WorkspaceSnapshot, HomeDecisionCard, WorkspaceAuditLog
  - Modified: ContentVariant, GrowthPrediction, ComplianceCheck
  - New services: workspace/session, workspace/snapshots, workspace/decision-cards
  - New API routes: /api/workspace/*, /api/home/decision-cards
  - New context: lib/workspace-state

### Code Review
- [ ] Address review comments
- [ ] Update database docs if needed

### Merge to Main
- [ ] Merge PR
- [ ] Delete feature branch
- [ ] Verify CI/CD passes

---

## 📋 Post-Implementation

### Update Documentation
- [ ] Update [ARCHITECTURE.md](./ARCHITECTURE.md) to document WorkspaceSession
- [ ] Add example: "How to create a workspace session"
- [ ] Add example: "How to transition between stages"

### Update Repository Memory
- [ ] Update `/memories/repo/bizopt-ui-analysis.md` with Phase 2.1 completion status

### Next Phase Planning
- [ ] Schedule Phase 2.2 kickoff (Home: 5 decision cards)
- [ ] Review Phase 2.2 requirements from [REFACTOR_TO_AI_OS.md](./REFACTOR_TO_AI_OS.md)
- [ ] Assign owner for Phase 2.2

---

## 🆘 Troubleshooting

### Prisma Migration Fails
```bash
# Check current migration status
npx prisma migrate status

# Reset database (dev only!)
npx prisma migrate reset

# Then apply new migration
npx prisma migrate dev --name add_workspace_sessions
```

### Build Errors
```bash
# Clear build cache
rm -rf .next
npm run db:generate
npm run build
```

### API Routes Not Working
- [ ] Check file paths (must be exact: `/api/workspace/[id]/route.ts`)
- [ ] Verify imports are correct
- [ ] Restart dev server: `npm run dev`

### TypeScript Errors
```bash
# Regenerate Prisma client
npm run db:generate

# Check for type mismatches
npm run lint
```

---

## 📊 Success Criteria

✅ **Phase 2.1 Complete When:**
- [ ] All 4 new tables created in database
- [ ] All services compile without errors
- [ ] All API routes respond correctly
- [ ] Manual tests pass (create, retrieve, update, list, compute)
- [ ] Home dashboard can render decision cards
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] PR merged to main
- [ ] Documentation updated

---

## ⏱️ Time Estimate

| Task | Duration |
|------|----------|
| Schema Design & Verification | 30 min |
| Database Migration | 15 min |
| Service Layer Implementation | 2-3 hours |
| API Route Creation | 1.5 hours |
| Client Context Setup | 1 hour |
| Testing & Verification | 2 hours |
| Build & Deploy | 30 min |
| **Total** | **8-9 hours** |

**Recommendation:** Do this in 1-2 days (split across 2 developer sessions)

---

## 🎯 Next Steps After Phase 2.1

Once Phase 2.1 is merged:

1. **Phase 2.2 (1 week)** → Transform Home into 5 decision cards
2. **Phase 2.3 (1-2 weeks)** → Upgrade AI Studio to creation cockpit
3. **Phase 2.4 (1 week)** → Add explainability to growth/compliance

See [REFACTOR_TO_AI_OS.md](./REFACTOR_TO_AI_OS.md) for complete roadmap.

---

## 📞 Questions?

Reference these docs:
- **"How do I structure the database?"** → [PHASE2.1_SCHEMA_ADDITIONS.md](./PHASE2.1_SCHEMA_ADDITIONS.md)
- **"What code do I write?"** → [PHASE2.1_IMPLEMENTATION.md](./PHASE2.1_IMPLEMENTATION.md)
- **"Why are we doing this?"** → [COMPETITIVE_DIFFERENTIATION.md](./COMPETITIVE_DIFFERENTIATION.md)
- **"What's the full plan?"** → [REFACTOR_TO_AI_OS.md](./REFACTOR_TO_AI_OS.md)

Good luck! 🚀
