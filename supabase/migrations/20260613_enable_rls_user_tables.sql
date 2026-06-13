-- Supabase RLS hardening for user-owned tables.
-- Assumption: auth.uid() returns the same user id format stored in app tables.
-- If your auth ids differ from app User.id values, map them before enabling these policies.

BEGIN;

-- ============================================================================
-- User table (self-owned by id)
-- ============================================================================
ALTER TABLE IF EXISTS public."User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select_own" ON public."User";
CREATE POLICY "user_select_own"
  ON public."User"
  FOR SELECT
  USING ("id" = auth.uid()::text);

DROP POLICY IF EXISTS "user_insert_own" ON public."User";
CREATE POLICY "user_insert_own"
  ON public."User"
  FOR INSERT
  WITH CHECK ("id" = auth.uid()::text);

DROP POLICY IF EXISTS "user_update_own" ON public."User";
CREATE POLICY "user_update_own"
  ON public."User"
  FOR UPDATE
  USING ("id" = auth.uid()::text)
  WITH CHECK ("id" = auth.uid()::text);

DROP POLICY IF EXISTS "user_delete_own" ON public."User";
CREATE POLICY "user_delete_own"
  ON public."User"
  FOR DELETE
  USING ("id" = auth.uid()::text);

-- ============================================================================
-- Tables with userId ownership column
-- ============================================================================
ALTER TABLE IF EXISTS public."UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MobileSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."OrgMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."IdeaBrief" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."EditorSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- UserSettings
DROP POLICY IF EXISTS "usersettings_select_own" ON public."UserSettings";
CREATE POLICY "usersettings_select_own" ON public."UserSettings"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "usersettings_insert_own" ON public."UserSettings";
CREATE POLICY "usersettings_insert_own" ON public."UserSettings"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "usersettings_update_own" ON public."UserSettings";
CREATE POLICY "usersettings_update_own" ON public."UserSettings"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "usersettings_delete_own" ON public."UserSettings";
CREATE POLICY "usersettings_delete_own" ON public."UserSettings"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- Account
DROP POLICY IF EXISTS "account_select_own" ON public."Account";
CREATE POLICY "account_select_own" ON public."Account"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "account_insert_own" ON public."Account";
CREATE POLICY "account_insert_own" ON public."Account"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "account_update_own" ON public."Account";
CREATE POLICY "account_update_own" ON public."Account"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "account_delete_own" ON public."Account";
CREATE POLICY "account_delete_own" ON public."Account"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- Session
DROP POLICY IF EXISTS "session_select_own" ON public."Session";
CREATE POLICY "session_select_own" ON public."Session"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "session_insert_own" ON public."Session";
CREATE POLICY "session_insert_own" ON public."Session"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "session_update_own" ON public."Session";
CREATE POLICY "session_update_own" ON public."Session"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "session_delete_own" ON public."Session";
CREATE POLICY "session_delete_own" ON public."Session"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- MobileSession
DROP POLICY IF EXISTS "mobile_session_select_own" ON public."MobileSession";
CREATE POLICY "mobile_session_select_own" ON public."MobileSession"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "mobile_session_insert_own" ON public."MobileSession";
CREATE POLICY "mobile_session_insert_own" ON public."MobileSession"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "mobile_session_update_own" ON public."MobileSession";
CREATE POLICY "mobile_session_update_own" ON public."MobileSession"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "mobile_session_delete_own" ON public."MobileSession";
CREATE POLICY "mobile_session_delete_own" ON public."MobileSession"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- OrgMember
DROP POLICY IF EXISTS "org_member_select_own" ON public."OrgMember";
CREATE POLICY "org_member_select_own" ON public."OrgMember"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "org_member_insert_own" ON public."OrgMember";
CREATE POLICY "org_member_insert_own" ON public."OrgMember"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "org_member_update_own" ON public."OrgMember";
CREATE POLICY "org_member_update_own" ON public."OrgMember"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "org_member_delete_own" ON public."OrgMember";
CREATE POLICY "org_member_delete_own" ON public."OrgMember"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- IdeaBrief
DROP POLICY IF EXISTS "idea_brief_select_own" ON public."IdeaBrief";
CREATE POLICY "idea_brief_select_own" ON public."IdeaBrief"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "idea_brief_insert_own" ON public."IdeaBrief";
CREATE POLICY "idea_brief_insert_own" ON public."IdeaBrief"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "idea_brief_update_own" ON public."IdeaBrief";
CREATE POLICY "idea_brief_update_own" ON public."IdeaBrief"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "idea_brief_delete_own" ON public."IdeaBrief";
CREATE POLICY "idea_brief_delete_own" ON public."IdeaBrief"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- EditorSession
DROP POLICY IF EXISTS "editor_session_select_own" ON public."EditorSession";
CREATE POLICY "editor_session_select_own" ON public."EditorSession"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "editor_session_insert_own" ON public."EditorSession";
CREATE POLICY "editor_session_insert_own" ON public."EditorSession"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "editor_session_update_own" ON public."EditorSession";
CREATE POLICY "editor_session_update_own" ON public."EditorSession"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "editor_session_delete_own" ON public."EditorSession";
CREATE POLICY "editor_session_delete_own" ON public."EditorSession"
  FOR DELETE USING ("userId" = auth.uid()::text);

-- AuditLog (only logs explicitly tied to current user)
DROP POLICY IF EXISTS "audit_log_select_own" ON public."AuditLog";
CREATE POLICY "audit_log_select_own" ON public."AuditLog"
  FOR SELECT USING ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "audit_log_insert_own" ON public."AuditLog";
CREATE POLICY "audit_log_insert_own" ON public."AuditLog"
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "audit_log_update_own" ON public."AuditLog";
CREATE POLICY "audit_log_update_own" ON public."AuditLog"
  FOR UPDATE USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);
DROP POLICY IF EXISTS "audit_log_delete_own" ON public."AuditLog";
CREATE POLICY "audit_log_delete_own" ON public."AuditLog"
  FOR DELETE USING ("userId" = auth.uid()::text);

COMMIT;
