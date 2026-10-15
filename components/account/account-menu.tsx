"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Building2, Check, ChevronDown, CircleHelp, LifeBuoy, LogOut, MessageSquareWarning, Settings, ShieldCheck, Users, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clearAccountClientCaches } from "@/lib/client-account-cache";
import { useAccount } from "./account-provider";
import { AccountDialog } from "./account-dialog";

export function AccountMenu() {
  const { account, loading, error, refresh, update } = useAccount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [actionError, setActionError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const contents = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setMobile(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open || mobile) return;
    contents.current?.querySelector<HTMLElement>("a[href], button:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => { if (!contents.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, mobile]);
  function close() { setOpen(false); trigger.current?.focus(); }
  async function logout() {
    setSwitching(true); setActionError("");
    try { await clearAccountClientCaches(); await signOut({ callbackUrl: "/login" }); }
    catch { setActionError("Sign out could not be completed. Please try again."); setSwitching(false); }
  }
  async function switchWorkspace(orgId: string) {
    setSwitching(true); setActionError("");
    try { await update({ action: "switch_workspace", orgId }); await clearAccountClientCaches(); window.location.assign("/home"); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Could not switch workspace."); setSwitching(false); }
  }
  const identity = account?.user.name || account?.user.email || "Your account";
  const links = [
    { href: "/settings", label: "Account settings", icon: Settings },
    { href: "/workspace", label: "Manage workspace", icon: Users },
    ...(account?.workspace.canInvite ? [{ href: "/workspace#invite", label: "Invite teammates", icon: UserPlus }] : []),
    { href: "/help", label: "Help Center", icon: CircleHelp },
    { href: "/support", label: "Contact support", icon: LifeBuoy },
    { href: `/support?report=1&workflow=${encodeURIComponent(pathname)}`, label: "Report an issue", icon: MessageSquareWarning },
    ...(account?.supportStaff ? [{ href: "/support-console", label: "Support console", icon: ShieldCheck }] : []),
  ];
  const body = <div ref={contents} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)"));
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      event.preventDefault(); items[next]?.focus();
    }
    if (event.key === "Tab" && !mobile) { const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)")); const first = items[0]; const last = items[items.length - 1]; if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) setOpen(false); }
  }}>
    <div className="border-b border-[var(--color-border)] p-4"><p className="break-words font-semibold">{identity}</p><p className="mt-1 break-all text-xs text-[var(--color-ink-muted)]">{account?.user.email}</p>{account && <div className="mt-4 rounded-xl bg-[var(--color-surface)] p-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-[var(--color-accent)]"/><p className="min-w-0 break-words text-sm font-medium">{account.workspace.name}</p></div><p className="mt-1 text-xs text-[var(--color-ink-muted)]">{account.workspace.planLabel} · {account.workspace.memberCount} {account.workspace.memberCount === 1 ? "person" : "people"}</p></div>}</div>
    {loading && <p role="status" className="p-4 text-sm text-[var(--color-ink-muted)]">Loading account…</p>}
    {error && <div className="p-4"><p role="alert" className="text-sm text-[var(--color-danger-fg)]">{error}</p><button className="mt-2 min-h-11 text-sm underline" onClick={() => void refresh()}>Retry account details</button></div>}
    {account && account.workspaces.length > 1 && <div className="border-b border-[var(--color-border)] p-2"><p className="px-2 py-1 text-xs font-medium text-[var(--color-ink-muted)]">Switch workspace</p>{account.workspaces.map((workspace) => <button key={workspace.id} disabled={switching || workspace.id === account.workspace.id} onClick={() => void switchWorkspace(workspace.id)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-[var(--color-surface)] disabled:opacity-60"><span className="break-words">{workspace.name}</span>{workspace.id === account.workspace.id && <Check className="h-4 w-4 shrink-0"/>}</button>)}</div>}
    <div className="p-2">{links.map(({ href, label, icon: Icon }) => <Link key={label} href={href} onClick={close} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-[var(--color-surface)]"><Icon className="h-4 w-4 shrink-0 text-[var(--color-ink-muted)]"/>{label}</Link>)}</div>
    {account && !account.workspace.canInvite && account.workspace.inviteDisabledReason && <p className="px-5 pb-3 text-xs text-[var(--color-ink-muted)]">{account.workspace.inviteDisabledReason}</p>}
    <div className="border-t border-[var(--color-border)] p-2"><button onClick={() => void logout()} disabled={switching} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--color-surface)] disabled:opacity-50"><LogOut className="h-4 w-4"/>{switching ? "Please wait…" : "Log out"}</button>{actionError && <p role="alert" className="px-3 py-2 text-sm text-[var(--color-danger-fg)]">{actionError}</p>}</div>
  </div>;
  return <div className="relative"><button ref={trigger} type="button" aria-label={`Account menu${account ? ` for ${identity}` : ""}`} aria-expanded={open} aria-controls="account-panel" onClick={() => setOpen(!open)} className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-card)] p-1 pr-2 shadow-[var(--shadow-card)]"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">{identity.slice(0, 1).toUpperCase()}</span><span className="hidden max-w-28 truncate text-sm font-medium sm:block">{account?.user.name?.split(" ")[0] || "Account"}</span><ChevronDown aria-hidden="true" className="h-4 w-4 text-[var(--color-ink-muted)]"/></button>{mobile ? <AccountDialog open={open} onClose={close} title="Your account"><div id="account-panel">{body}</div></AccountDialog> : open && <div id="account-panel" aria-label="Your account" className="absolute right-0 top-[calc(100%+0.5rem)] z-40 max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] shadow-[var(--shadow-elevated)]">{body}</div>}</div>;
}
