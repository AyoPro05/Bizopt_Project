-- Apply with the editor-session release after its tables exist.
-- Only the privileged server role accesses personal editor state; no browser policies.
BEGIN;
ALTER TABLE "WorkspaceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeDecisionCard" ENABLE ROW LEVEL SECURITY;
COMMIT;
