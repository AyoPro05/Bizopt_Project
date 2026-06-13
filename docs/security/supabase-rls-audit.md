# Supabase RLS Audit

Audit date: 2026-06-13

## Summary

- No existing Supabase RLS policy SQL was found in this repository for user-owned app tables.
- The migration `supabase/migrations/20260613_enable_rls_user_tables.sql` was added to enable RLS and create `SELECT/INSERT/UPDATE/DELETE` ownership policies.

## Tables currently missing repository-defined RLS before this migration

These user-owned tables were identified as lacking RLS policy definitions in-repo:

- `User`
- `UserSettings`
- `Account`
- `Session`
- `MobileSession`
- `OrgMember`
- `IdeaBrief`
- `EditorSession`
- `AuditLog`

> Note: This audit is repository-based (SQL/migrations scan), not a live database introspection.
> To confirm live status, run:
>
> ```sql
> select schemaname, tablename, rowsecurity
> from pg_tables
> where schemaname = 'public'
> order by tablename;
> ```
