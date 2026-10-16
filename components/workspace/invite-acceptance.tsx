"use client";

import Link from "next/link";
import { getSession, signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Building2, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { accountRequest } from "@/components/account/account-provider";
import { clearAccountClientCaches } from "@/lib/client-account-cache";

type Proof = { id: string; token: string };
type Preview = { workspaceName: string; emailHint: string; role: string; expiresAt: string };
export function InviteAcceptance() {
  const captured = useRef(false);
  const proof = useRef<Proof | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const fragment = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    const params = new URLSearchParams(fragment);
    const id = params.get("id"); const token = params.get("token");
    if (!id || !token || fragment.length > 4096) { setError("This invitation link is incomplete. Open the complete link from your invitation email."); setLoading(false); return; }
    proof.current = { id, token };
    void Promise.all([
      accountRequest<Preview | { result: Preview }>("/api/workspace/invite", { action: "preview", id, token }).then((data) => setPreview("result" in data ? data.result : data)),
      getSession().then((session) => setIdentity(session?.user?.email ?? null)),
    ]).catch((err) => setError(err instanceof Error ? err.message : "This invitation is unavailable or has expired.")).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const refreshIdentity = () => { void getSession().then((session) => setIdentity(session?.user?.email ?? null)); };
    window.addEventListener("focus", refreshIdentity);
    return () => window.removeEventListener("focus", refreshIdentity);
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await signIn("credentials", { email: email.trim(), password, redirect: false }); if (result?.error) throw new Error("Unable to sign in with these details. Check your email and password."); setPassword(""); const session = await getSession(); setIdentity(session?.user?.email ?? null); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in. Please try again."); }
    finally { setBusy(false); }
  }
  async function switchAccount() {
    setBusy(true); setError("");
    try { await clearAccountClientCaches(); await signOut({ redirect: false }); setIdentity(null); setPassword(""); }
    catch { setError("Could not sign out. Please try again."); }
    finally { setBusy(false); }
  }
  async function accept() {
    if (!proof.current) return;
    setBusy(true); setError("");
    try { await accountRequest("/api/workspace/invite", { action: "accept", ...proof.current }); proof.current = null; setAccepted(true); }
    catch (err) { setError(err instanceof Error ? err.message : "This invitation could not be accepted. Check the account and email verification, then retry."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16"><div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] sm:p-8"><div aria-hidden="true" className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]"><Building2 className="h-6 w-6"/></div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Workspace invitation</p><h1 className="mt-3 break-words font-display text-3xl font-semibold">{accepted ? "You’re part of the team." : preview ? `Join ${preview.workspaceName}.` : "A shared place to grow."}</h1>
    {loading && <p role="status" className="mt-5 text-sm text-[var(--color-ink-muted)]">Checking your invitation…</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-[var(--color-danger-bg)] p-4 text-sm leading-6 text-[var(--color-danger-fg)]">{error}</p>}
    {accepted ? <div className="mt-6"><p role="status" className="flex items-start gap-2 text-sm text-[var(--color-success-fg)]"><CheckCircle2 className="h-5 w-5 shrink-0"/>Your invitation was accepted. Workspace access is ready.</p><a href="/workspace" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-sm font-medium text-white">Open workspace<ArrowUpRight className="h-4 w-4"/></a></div> : preview && !loading && <div className="mt-6 space-y-6"><div className="rounded-xl bg-[var(--color-surface)] p-4 text-sm"><p className="flex items-start gap-2 break-all"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ink-muted)]"/>Invited email: {preview.emailHint}</p><p className="mt-2 text-[var(--color-ink-muted)]">Access: {preview.role}<br/>Expires {new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p></div>{identity ? <div><p className="break-all text-sm">Signed in as <strong>{identity}</strong>.</p><p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">Accept with the same verified email that received this invitation. Accepting joins the workspace without changing its subscription price.</p><Button className="mt-5 min-h-11 w-full" disabled={busy} onClick={() => void accept()}>{busy ? "Please wait…" : "Accept invitation"}</Button><Button variant="ghost" disabled={busy} className="mt-2 min-h-11 w-full" onClick={() => void switchAccount()}>Use a different account</Button></div> : <div><h2 className="font-display text-xl font-semibold">Sign in to accept</h2><p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">Use the email address that received the invitation. Your invitation stays on this page while you sign in.</p><form onSubmit={login} className="mt-5 space-y-4"><label className="block text-sm font-medium" htmlFor="invite-login-email">Email<Input id="invite-login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11"/></label><label className="block text-sm font-medium" htmlFor="invite-login-password">Password<Input id="invite-login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11"/></label><Button type="submit" disabled={busy} className="min-h-11 w-full">{busy ? "Signing in…" : "Sign in"}</Button></form><p className="mt-5 text-sm leading-6 text-[var(--color-ink-muted)]">New to BizOptz? <Link href="/signup" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--color-accent)] underline">Create an account in a new tab</Link>, verify your email, then return here to sign in and accept.</p></div>}<p className="flex items-start gap-2 border-t border-[var(--color-border)] pt-4 text-xs leading-5 text-[var(--color-ink-muted)]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Keep this invitation private. If this page is closed or refreshed before acceptance, reopen the original invitation email link.</p></div>}
    {!loading && !preview && <Link href="/login" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)]">Go to sign in →</Link>}
  </div></div>;
}
