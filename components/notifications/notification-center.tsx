"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

type Notice = { id: string; type: string; category: string; title: string; body: string; href: string; createdAt: string; readAt: string | null };
export async function notificationRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers } });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "This request could not be completed. Please try again.");
  return value;
}
export function NotificationBell() {
  return <Link href="/notifications" aria-label="Notifications" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-[var(--color-surface)] focus-visible:outline-2"><Bell className="h-5 w-5" aria-hidden="true"/></Link>;
}
export function NotificationCenter() {
  const [notices, setNotices] = useState<Notice[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(""), [busy, setBusy] = useState(""), [unreadOnly, setUnreadOnly] = useState(false);
  async function refresh() { setLoading(true); setError(""); try { const value = await notificationRequest<{ notifications: Notice[] }>("/api/notifications"); setNotices(value.notifications); } catch (cause) { setError((cause as Error).message); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  async function mark(id: string) { setBusy(id); setError(""); try { await notificationRequest(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" }); setNotices(old => old.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); } }
  const visible = notices.filter(item => !unreadOnly || !item.readAt);
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-accent)]">Your account, in view</p><h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Stay in the loop.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)]">Account updates and workspace alerts, saved here for you. Essential notices remain available when email delivery is unavailable.</p></div><Link href="/settings/notifications" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4"><SlidersHorizontal className="h-4 w-4"/>Notification preferences</Link></div><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/>Unread only</label><Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4"/>Refresh notifications</Button></div>{error && <Callout tone="danger">{error}</Callout>}{loading ? <p role="status">Loading your notifications…</p> : visible.length ? <ul className="space-y-4">{visible.map(item => <li key={item.id}><Card className={`min-w-0 p-5 sm:p-6 ${!item.readAt ? "border-l-4 border-l-[var(--color-accent)]" : ""}`}><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]"><span>{item.category.toLowerCase()} · {item.readAt ? "Read" : "Unread"}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div><h2 className="mt-3 break-words font-display text-xl font-semibold">{item.title}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--color-ink-muted)]">{item.body}</p><div className="mt-4 flex flex-wrap gap-3">{item.href?.startsWith("/") && !item.href.startsWith("//") && <Link href={item.href} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">View details →</Link>}{!item.readAt && <Button variant="ghost" onClick={() => void mark(item.id)} disabled={busy === item.id}><Check className="h-4 w-4"/>Mark as read</Button>}</div></Card></li>)}</ul> : <Card className="py-12 text-center"><Bell className="mx-auto h-7 w-7 text-[var(--color-accent)]"/><h2 className="mt-4 font-display text-xl font-semibold">You’re all caught up.</h2><p className="mt-2 text-sm text-[var(--color-ink-muted)]">{unreadOnly ? "There are no unread updates in this workspace." : "Saved account and workspace updates will appear here."}</p></Card>}</div>;
}
