"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Download, Fingerprint, Laptop, LockKeyhole, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { clearAccountClientCaches, clearLocalDraftRecoveryCopies } from "@/lib/client-account-cache";
import { AccountDialog } from "./account-dialog";
import { useAccount } from "./account-provider";

type SensitiveAction = { action: "revoke_session"; sessionId: string; title: string } | { action: "sign_out_all"; title: string } | { action: "privacy_request"; kind: "export" | "deletion"; title: string };
const muted = "text-sm leading-6 text-[var(--color-ink-muted)]";
const panel = "rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5 sm:p-6";
function timestamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZoneName: undefined }); }

export function AccountSettings() {
  const { account, loading, error, refresh, update } = useAccount();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [sensitive, setSensitive] = useState<SensitiveAction | null>(null);
  const [password, setPassword] = useState("");
  useEffect(() => { if (account) setName(account.user.name ?? ""); }, [account]);
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(""); setActionError("");
    try { await update({ action: "profile", name: name.trim() }); setMessage("Your profile has been saved."); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Your profile could not be saved."); }
    finally { setSaving(false); }
  }
  async function preferences(field: "supportEmail" | "localDraftRecovery", value: boolean) {
    if (!account) return;
    setSaving(true); setMessage(""); setActionError("");
    try { await update({ action: "preferences", ...account.preferences, [field]: value }); if (field === "localDraftRecovery" && !value) clearLocalDraftRecoveryCopies(); setMessage("Your preference has been saved."); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Your preference could not be saved."); }
    finally { setSaving(false); }
  }
  async function confirmSensitive(event: React.FormEvent) {
    event.preventDefault(); if (!sensitive) return;
    setSaving(true); setActionError(""); setMessage("");
    try {
      const payload = sensitive.action === "revoke_session" ? { action: sensitive.action, sessionId: sensitive.sessionId } : sensitive.action === "privacy_request" ? { action: sensitive.action, kind: sensitive.kind } : { action: sensitive.action };
      await update({ ...payload, password });
      const currentSession = sensitive.action === "revoke_session" && (sensitive.sessionId === account?.currentSessionId || account?.sessions.some((session) => session.id === sensitive.sessionId && session.current));
      if (sensitive.action === "sign_out_all" || currentSession) { await clearAccountClientCaches(); await signOut({ callbackUrl: "/login" }); return; }
      setMessage(sensitive.action === "privacy_request" ? `Your ${sensitive.kind === "export" ? "data export" : "account deletion"} request has been received. Follow its progress in Support.` : "The session has been revoked.");
      setSensitive(null); setPassword("");
    } catch (err) { setActionError(err instanceof Error ? err.message : "The request could not be completed."); }
    finally { setSaving(false); }
  }
  function openAction(action: SensitiveAction) { setActionError(""); setPassword(""); setSensitive(action); }
  if (loading) return <p role="status" className={muted}>Loading your account settings…</p>;
  if (!account) return <div className={panel}><p role="alert" className="text-[var(--color-danger-fg)]">{error || "Your account details are unavailable."}</p><Button onClick={() => void refresh()} className="mt-4 min-h-11">Try again</Button></div>;
  const sessions = [...account.sessions.map((session) => ({ ...session, type: "Browser" })), ...account.mobileSessions.map((session) => ({ ...session, type: "Mobile" }))];
  return <div className="space-y-6">
    <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Your BizOptz</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">A place for your preferences.</h1><p className={`mt-3 ${muted}`}>Keep your identity, sign-ins and privacy choices in one place. Workspace roles and billing stay with your business.</p></div>
    {message && <p role="status" className="flex items-start gap-2 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-4 text-sm text-[var(--color-success-fg)]"><CheckCircle2 className="h-5 w-5 shrink-0"/>{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning-fg)]">Some account information may be out of date. {error} <button className="min-h-11 underline" onClick={() => void refresh()}>Refresh</button></p>}
    {actionError && !sensitive && <p role="alert" className="rounded-xl bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-danger-fg)]">{actionError}</p>}
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="min-w-0 space-y-6">
        <section className={panel} aria-labelledby="profile-title"><div className="flex items-center gap-3"><UserRound aria-hidden="true" className="h-5 w-5 text-[var(--color-accent)]"/><h2 id="profile-title" className="font-display text-xl font-semibold">Profile & identity</h2></div><form onSubmit={saveProfile} className="mt-5 space-y-4"><label className="block text-sm font-medium" htmlFor="account-name">Your name<Input id="account-name" className="mt-2 min-h-11" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120}/></label><div><p className="text-sm font-medium">Account email</p><p className="mt-2 break-all text-sm">{account.user.email}</p><p className={`mt-1 ${muted}`}>{account.user.emailVerified ? "Email verified" : "Email verification is required before accepting workspace invitations."}</p></div><Button type="submit" disabled={saving || name.trim() === (account.user.name ?? "")} className="min-h-11">{saving ? "Saving…" : "Save profile"}</Button></form></section>
        <section id="security" className={panel} aria-labelledby="security-title"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[var(--color-accent)]"/><h2 id="security-title" className="font-display text-xl font-semibold">Security & sessions</h2></div><p className={`mt-3 ${muted}`}>Review active sign-ins. Your current password is required to revoke access. Workspace device authorisation is managed separately.</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-1"><Link href="/devices" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-accent)]">Trusted devices<ArrowUpRight className="h-4 w-4"/></Link><Link href="/support?category=account" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-accent)]">Account recovery help<ArrowUpRight className="h-4 w-4"/></Link></div>
          {sessions.length ? <ul className="mt-2 divide-y divide-[var(--color-border)]">{sessions.map((session) => <li key={`${session.type}-${session.id}`} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="flex min-w-0 flex-1 gap-3"><Laptop className="mt-1 h-4 w-4 shrink-0 text-[var(--color-ink-muted)]"/><div className="min-w-0"><p className="break-words text-sm font-medium">{session.label || `${session.type} session`}{(session.current || session.id === account.currentSessionId) && <span className="ml-2 rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-xs text-[var(--color-accent)]">This device</span>}</p><p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]">{session.type} · Last active {timestamp(session.lastUsedAt)}<br/>Expires {timestamp(session.expiresAt)}</p></div></div><Button variant="secondary" className="min-h-11" disabled={saving} onClick={() => openAction({ action: "revoke_session", sessionId: session.id, title: "Revoke this session?" })}>Revoke</Button></li>)}</ul> : <p className={`mt-4 ${muted}`}>No active sessions were returned. Refresh before making changes.</p>}
          <Button variant="secondary" className="mt-4 min-h-11" onClick={() => openAction({ action: "sign_out_all", title: "Sign out all devices?" })}><LockKeyhole className="h-4 w-4"/>Sign out all devices</Button>
        </section>
        <section id="privacy" className={panel} aria-labelledby="privacy-title"><div className="flex items-center gap-3"><Fingerprint className="h-5 w-5 text-[var(--color-accent)]"/><h2 id="privacy-title" className="font-display text-xl font-semibold">Privacy & your data</h2></div><p className={`mt-3 ${muted}`}>Request an export or account deletion through a private support request. We verify the scope and identity before providing data or making irreversible changes.</p><details className="mt-4 rounded-xl bg-[var(--color-surface)] p-4"><summary className="cursor-pointer text-sm font-medium">What happens before account deletion?</summary><p className={`mt-3 ${muted}`}>Transfer workspace ownership first if you are its only owner. Workspace-owned work remains with the workspace. Active subscriptions and any billing obligations must be reviewed separately. Retention requirements, connected-provider credentials, files and AI history are reviewed with your request. Backups follow their documented retention schedule; immediate backup erasure is not promised.</p><Link href="/workspace" className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--color-accent)]">Manage ownership →</Link></details><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" className="min-h-11" onClick={() => openAction({ action: "privacy_request", kind: "export", title: "Request your account data" })}><Download className="h-4 w-4"/>Request data export</Button><Button variant="ghost" className="min-h-11 text-[var(--color-danger-fg)]" onClick={() => openAction({ action: "privacy_request", kind: "deletion", title: "Request account deletion" })}>Request account deletion</Button></div></section>
      </div>
      <div className="min-w-0 space-y-6">
        <section className={panel} aria-labelledby="preferences-title"><div className="mb-5 flex items-center gap-3"><SlidersHorizontal className="h-5 w-5 text-[var(--color-accent)]"/><h2 id="preferences-title" className="font-display text-xl font-semibold">Make it yours</h2></div><ThemeToggle/><p className={`mt-4 ${muted}`}>Motion follows your device’s reduced-motion setting. Text and layouts adapt to browser zoom.</p><div className="mt-6 space-y-5 border-t border-[var(--color-border)] pt-5"><label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" checked={account.preferences.supportEmail} onChange={(event) => void preferences("supportEmail", event.target.checked)} disabled={saving} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"/><span><span className="text-sm font-medium">Support email updates</span><span className={`mt-1 block ${muted}`}>Request email updates for your tickets. Availability depends on the configured mail service; your ticket history remains in Support.</span></span></label><label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" checked={account.preferences.localDraftRecovery} onChange={(event) => void preferences("localDraftRecovery", event.target.checked)} disabled={saving} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"/><span><span className="text-sm font-medium">Recover unsaved drafts on this browser</span><span className={`mt-1 block ${muted}`}>Allow supported editors to keep a local recovery copy. Leave this off on shared devices. Turning it off clears local BizOptz drafts.</span></span></label></div></section>
        <section className={panel}><p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">Workspace</p><h2 className="mt-2 break-words font-display text-2xl font-semibold">{account.workspace.name}</h2><p className={`mt-2 ${muted}`}>{account.workspace.planLabel} · {account.workspace.memberCount} {account.workspace.memberCount === 1 ? "person" : "people"}<br/>Your role: {account.workspace.role}</p><div className="mt-4 flex flex-col items-start"><Link href="/workspace" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-accent)]">Manage workspace<ArrowUpRight className="h-4 w-4"/></Link><Link href="/integrations" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-accent)]">Connected apps<ArrowUpRight className="h-4 w-4"/></Link>{account.workspace.canManageBilling && <Link href="/billing" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-accent)]">Billing & subscription<ArrowUpRight className="h-4 w-4"/></Link>}</div></section>
      </div>
    </div>
    <AccountDialog open={!!sensitive} onClose={() => { if (!saving) { setSensitive(null); setPassword(""); setActionError(""); } }} title={sensitive?.title ?? "Verify your identity"}><form onSubmit={confirmSensitive} className="space-y-4"><p className={muted}>{sensitive?.action === "privacy_request" ? "This creates a private request for review. It does not immediately export or delete data. You can follow up in Support." : sensitive?.action === "sign_out_all" ? "Every active session, including this one, will be signed out. You will need to sign in again." : "This sign-in will lose access immediately. Saved workspace work is preserved."}</p><label htmlFor="sensitive-password" className="block text-sm font-medium">Current password<Input id="sensitive-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 min-h-11"/></label>{actionError && <p role="alert" className="text-sm text-[var(--color-danger-fg)]">{actionError}</p>}<div className="flex flex-wrap gap-3"><Button type="submit" disabled={saving || !password} className="min-h-11">{saving ? "Please wait…" : sensitive?.action === "privacy_request" ? "Confirm request" : "Confirm"}</Button><Button variant="secondary" disabled={saving} className="min-h-11" onClick={() => { setSensitive(null); setPassword(""); setActionError(""); }}>Cancel</Button></div></form></AccountDialog>
  </div>;
}
