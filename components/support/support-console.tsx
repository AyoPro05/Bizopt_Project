"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConversationBody, Field, selectClass, StatusMessage, statusLabel, supportRequest, type Ticket } from "./shared";
import { statuses } from "@/services/support/schemas";

export function SupportConsole() {
  const [unlocked, setUnlocked] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [staff, setStaff] = useState<{ userId: string; role: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!expiresAt) return;
    const timeout = setTimeout(() => { setUnlocked(false); setTicket(null); setTickets([]); setStaff(null); setBody(""); setError("Your privileged access expired. Unlock the console again."); }, Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timeout);
  }, [expiresAt]);
  async function queue() {
    const value = await supportRequest(`/api/support/staff?q=${encodeURIComponent(query)}&status=${encodeURIComponent(filter)}`);
    setTickets(value.tickets); setStaff(value.staff);
  }
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const payload = JSON.stringify({ password: fields.get("password"), code: fields.get("code") });
    form.reset();
    try {
      const value = await supportRequest("/api/support/staff/unlock", { method: "POST", body: payload });
      setUnlocked(true); setExpiresAt(value.expiresAt); await queue();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function lock() {
    setBusy(true); setError(""); setTicket(null); setBody("");
    try {
      await supportRequest("/api/support/staff/unlock", { method: "DELETE" });
      setUnlocked(false); setExpiresAt(""); setTickets([]); setStaff(null); setMessage("Privileged support access ended.");
    } catch { setError("The grant could not be revoked. Retry Lock console or sign out to end this browser session."); }
    finally { setBusy(false); }
  }
  async function openTicket(id: string) {
    setBusy(true); setError("");
    try { const value = await supportRequest(`/api/support/staff/${id}`); setTicket(value.ticket); setStatus(value.ticket.status); setBody(""); setInternal(true); }
    catch (cause) { setError((cause as Error).message); setTicket(null); }
    finally { setBusy(false); }
  }
  async function update(extra: Record<string, unknown> = {}) {
    if (!ticket) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await supportRequest(`/api/support/staff/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ expectedVersion: ticket.version, ...(body.trim() ? { body, internal } : {}), ...(status !== ticket.status ? { status } : {}), ...extra }) });
      setBody(""); setMessage("Conversation update saved. Customer replies are delivered in the app.");
      try { const value = await supportRequest(`/api/support/staff/${ticket.id}`); setTicket(value.ticket); setStatus(value.ticket.status); await queue(); } catch { setTicket(null); setMessage("Update saved. Reload the queue to inspect the latest state."); }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6 text-[var(--color-ink)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">Privileged operations</p><h1 className="mt-2 font-display text-3xl font-semibold">Support console</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-muted)]">Separately authorised support staff only. Queue views, private conversation access and changes are audited.</p></div>{unlocked && <Button onClick={lock} variant="secondary" disabled={busy} className="min-h-11">Lock console</Button>}</div><StatusMessage error={error} message={message} />{!unlocked ? <Card className="max-w-lg"><h2 className="text-lg font-semibold">Verify privileged access</h2><p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">Use your current password and your operator-enrolled authenticator. Workspace ownership alone does not grant access. An unlock lasts ten minutes in this browser session.</p><form onSubmit={unlock} className="mt-5 space-y-4"><Field label="Current password"><Input type="password" name="password" required maxLength={100} autoComplete="current-password" /></Field><Field label="Authenticator code"><Input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></Field><Button type="submit" loading={busy} className="min-h-11">Unlock support console</Button></form></Card> : <><p className="text-xs text-[var(--color-ink-muted)]">Role: {staff?.role.replaceAll("_", " ")} · Access ends {new Date(expiresAt).toLocaleString()}. Agents see unassigned conversations and their own assignments; security reports require a support administrator.</p><div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"><Card className="min-w-0 p-4 sm:p-6"><h2 className="text-lg font-semibold">Triage queue</h2><p className="mt-2 text-xs text-[var(--color-ink-muted)]">Operational metadata only. Opening a conversation loads private content and records an access event.</p><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); queue().catch((cause) => setError(cause.message)).finally(() => setBusy(false)); }} className="mt-4 grid gap-3"><Field label="Search subjects"><Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} /></Field><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter triage status" className={selectClass}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select><Button type="submit" variant="secondary" disabled={busy} className="min-h-11">Refresh queue</Button></form>{!tickets.length ? <p className="py-6 text-sm text-[var(--color-ink-muted)]">No conversations in this scope.</p> : <ul className="mt-4 divide-y divide-[var(--color-border-strong)]">{tickets.map((item) => <li key={item.id} className="py-3"><p className="break-words text-sm font-semibold">{item.subject}</p><p className="mt-1 text-xs capitalize text-[var(--color-ink-muted)]">{statusLabel(item.status)} · {item.severity} · {item.assigneeId ? "Assigned" : "Unassigned"}</p>{item.isSecurity && <p className="mt-1 text-xs font-semibold">Private security report</p>}<Button variant="ghost" className="mt-2 min-h-11" disabled={busy} onClick={() => openTicket(item.id)}>Open private conversation</Button></li>)}</ul>}</Card>{ticket ? <Card className="min-w-0 space-y-4 p-4 sm:p-6"><h2 className="break-words text-lg font-semibold">{ticket.subject}</h2><p className="break-all text-xs text-[var(--color-ink-muted)]">Report {ticket.id} · Workspace {ticket.orgId} · Version {ticket.version}</p><ConversationBody ticket={ticket} staff />{ticket.diagnostics && <details><summary className="min-h-11 cursor-pointer text-sm font-medium">Consented diagnostics</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(ticket.diagnostics, null, 2)}</pre></details>}<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} className="min-h-11" onClick={() => update({ assigneeId: staff?.userId })}>Assign to me</Button><Button variant="ghost" disabled={busy} className="min-h-11" onClick={() => update({ assigneeId: null })}>Unassign</Button></div><form onSubmit={(event) => { event.preventDefault(); void update(); }} className="space-y-4 border-t border-[var(--color-border-strong)] pt-4"><Field label="Conversation status"><select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></Field><Field label="Message visibility"><select value={internal ? "internal" : "public"} onChange={(event) => setInternal(event.target.value === "internal")} className={selectClass}><option value="internal">Internal note · staff only</option><option value="public">Customer-visible reply</option></select></Field><Field label={internal ? "Internal note (optional)" : "Reply to the customer"}><Textarea rows={4} value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} /></Field>{!internal && <p className="text-sm font-medium text-[var(--color-accent)]">This message will be visible to the customer.</p>}<div className="flex flex-wrap gap-2"><Button type="submit" loading={busy} disabled={!body.trim() && status === ticket.status} className="min-h-11">{body.trim() ? internal ? "Save internal note and status" : "Send customer reply and status" : "Save status"}</Button><Button type="button" variant="ghost" onClick={() => { setTicket(null); setBody(""); }} className="min-h-11">Close content</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => openTicket(ticket.id)} className="min-h-11">Reload conversation</Button></div></form></Card> : <Card className="p-6"><h2 className="font-semibold">Choose a conversation</h2><p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">Private descriptions, replies and internal notes stay hidden until you explicitly open a report.</p></Card>}</div></>}</div>;
}
