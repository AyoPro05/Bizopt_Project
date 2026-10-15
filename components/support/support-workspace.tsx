"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConversationBody, Field, selectClass, statusLabel, StatusMessage, supportRequest, type Ticket } from "./shared";
import { sanitiseDiagnostics, statuses } from "@/services/support/schemas";

export function SupportWorkspace({ security = false, workflow = "General", issue = false }: { security?: boolean; workflow?: string; issue?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [reply, setReply] = useState("");
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const requestId = useRef("");
  const detail = useRef<HTMLHeadingElement>(null);
  const loadTickets = async () => {
    const value = await supportRequest(`/api/support?q=${encodeURIComponent(query)}&status=${encodeURIComponent(filter)}`);
    setTickets(value.tickets);
  };
  useEffect(() => {
    const controller = new AbortController();
    supportRequest("/api/support", { signal: controller.signal }).then((value) => setTickets(value.tickets)).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function openTicket(id: string) {
    setError(""); setBusy(true);
    try { const value = await supportRequest(`/api/support/${encodeURIComponent(id)}`); setTicket(value.ticket); setTimeout(() => detail.current?.focus(), 0); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await loadTickets(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  function setDiagnostics(enabled: boolean) {
    setConsent(enabled);
    // Access optional browser information only after the explicit opt-in.
    if (enabled) {
      const ua = navigator.userAgent;
      const browser = /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chromium" : /Safari\//.test(ua) ? "Safari" : "Other";
      const browserVersion = ua.match(/(?:Firefox|Chrome|Version)\/([\d.]+)/)?.[1];
      setPreview(sanitiseDiagnostics({ appVersion: "0.1.0", browser, browserVersion, route: workflow.startsWith("/") ? workflow : window.location.pathname }, true));
    } else setPreview(null);
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const value = await supportRequest("/api/support", { method: "POST", body: JSON.stringify({ requestId: requestId.current, category: fields.get("category"), subject: fields.get("subject"), description: fields.get("description"), severity: fields.get("severity"), workflow: fields.get("workflow"), reproducibility: fields.get("reproducibility"), diagnosticsConsent: consent, ...(consent ? { diagnostics: preview } : {}), notifyByEmail: fields.get("notifyByEmail") === "on" }) });
      requestId.current = ""; form.reset(); setConsent(false); setPreview(null);
      setMessage("Report received. Follow replies in Your conversations below. Email delivery is unavailable.");
      try { await loadTickets(); const loaded = await supportRequest(`/api/support/${value.ticket.id}`); setTicket(loaded.ticket); } catch { setMessage("Report received. Refresh your conversations to read it; the confirmation is saved on the server."); }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function sendReply(event: FormEvent) {
    event.preventDefault(); if (!ticket) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await supportRequest(`/api/support/${ticket.id}`, { method: "POST", body: JSON.stringify({ body: reply, expectedVersion: ticket.version, reopen: ["resolved", "closed"].includes(ticket.status) }) });
      setReply(""); setMessage("Your reply was saved.");
      try { const value = await supportRequest(`/api/support/${ticket.id}`); setTicket(value.ticket); await loadTickets(); } catch { setMessage("Your reply was saved. Refresh the conversation to see the latest version."); }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 text-[var(--color-ink)]"><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">Here to help</p><h1 className="font-display text-3xl font-semibold">{security ? "Private security report" : issue ? "Report an issue" : "Contact support"}</h1><p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">Tell us what happened, then follow the conversation here. Human availability and response times are not guaranteed.</p></div><Link href="/help" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--color-border-strong)] px-4 text-sm font-medium">Browse Help Center</Link></div><StatusMessage error={error} message={message} /><div className="grid min-w-0 items-start gap-6 xl:grid-cols-2"><Card className="min-w-0 p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Start a conversation</h2><form onSubmit={create} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select name="category" defaultValue={security ? "security" : issue ? "technical" : "technical"} className={selectClass}>{[["technical", "Technical problem"], ["seo", "SEO workflow"], ["billing", "Billing question"], ["account", "Account access"], ["privacy", "Privacy request"], ["security", "Private security report"], ["feedback", "Product feedback"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Suggested severity"><select name="severity" defaultValue="normal" className={selectClass}>{["low", "normal", "high", "urgent"].map((value) => <option key={value}>{value}</option>)}</select></Field></div><Field label="Subject"><Input name="subject" minLength={4} maxLength={160} required placeholder="What do you need help with?" /></Field><Field label="Affected workflow"><Input name="workflow" defaultValue={workflow} maxLength={100} required /></Field><Field label="What happened?" hint="Include what you expected and steps already tried. Leave out passwords, payment details, tokens and private documents."><Textarea name="description" rows={5} minLength={10} maxLength={10000} required /></Field><Field label="How can we reproduce it? (optional)"><Textarea name="reproducibility" rows={2} maxLength={1000} /></Field><div className="rounded-lg bg-[var(--color-surface)] p-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setDiagnostics(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--color-accent)]" />Include optional technical diagnostics</label><p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">Opt in to preview version, browser and this static route. Nothing is collected until you opt in. You can exclude everything by clearing the box.</p>{preview && <pre className="mt-3 whitespace-pre-wrap break-all text-xs" aria-label="Diagnostics preview">{JSON.stringify(preview, null, 2)}</pre>}</div><label className="flex min-h-11 items-start gap-3 text-sm"><input name="notifyByEmail" type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" /><span>Save my preference for email updates<span className="mt-1 block text-xs text-[var(--color-ink-muted)]">Email delivery is currently unavailable. All replies remain in the app.</span></span></label><p className="text-xs text-[var(--color-ink-muted)]">Attachments are unavailable. Use a written description without private files.</p><Button type="submit" loading={busy} className="min-h-11 w-full">Send report</Button>{!security && <Link href="/support?security=1" className="inline-flex min-h-11 items-center text-sm text-[var(--color-accent)] underline underline-offset-4">Report a security concern privately</Link>}</form></Card><section className="min-w-0 space-y-6" aria-label="Your support conversations"><Card className="min-w-0 p-4 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Your conversations</h2><form onSubmit={search} className="mb-4 grid gap-3"><Field label="Search subject or report ID"><Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} /></Field><div className="flex flex-wrap gap-2"><select aria-label="Filter conversations by status" className={`${selectClass} flex-1`} value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select><Button type="submit" variant="secondary" disabled={busy} className="min-h-11">Search</Button></div></form>{loading ? <p role="status" className="text-sm">Loading conversations…</p> : !tickets.length ? <p className="py-4 text-sm text-[var(--color-ink-muted)]">No conversations match. Your submitted reports will appear here.</p> : <ul className="divide-y divide-[var(--color-border-strong)]">{tickets.map((item) => <li key={item.id}><button type="button" disabled={busy} onClick={() => { if (ticket?.id !== item.id) setReply(""); void openTicket(item.id); }} className="flex min-h-16 w-full flex-col items-start gap-1 rounded-lg px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"><span className="break-words text-sm font-medium">{item.subject}</span><span className="text-xs capitalize text-[var(--color-ink-muted)]">{statusLabel(item.status)} · {new Date(item.updatedAt).toLocaleDateString()}</span></button></li>)}</ul>}</Card>{ticket && <Card className="min-w-0 space-y-4 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-2"><h2 ref={detail} tabIndex={-1} className="min-w-0 break-words text-lg font-semibold focus:outline-none">{ticket.subject}</h2><Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => openTicket(ticket.id)}>Refresh</Button></div><p className="break-all text-xs text-[var(--color-ink-muted)]">Report {ticket.id}</p><ConversationBody ticket={ticket} /><form onSubmit={sendReply} className="space-y-3"><Field label={["resolved", "closed"].includes(ticket.status) ? "Explain why you need to reopen this conversation" : "Add a reply"}><Textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} required maxLength={10000} /></Field><Button type="submit" loading={busy} className="min-h-11">{["resolved", "closed"].includes(ticket.status) ? "Reopen and send reply" : "Send reply"}</Button></form></Card>}</section></div></div>;
}
