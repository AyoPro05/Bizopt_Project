"use client";
import { cloneElement, isValidElement, useId, type ReactNode, type ReactElement } from "react";

export const selectClass = "min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  return <div className="grid min-w-0 gap-1.5 text-sm font-medium text-[var(--color-ink)]"><label htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id: string; "aria-describedby"?: string }>, { id, ...(hint ? { "aria-describedby": `${id}-hint` } : {}) }) : children}{hint && <span id={`${id}-hint`} className="text-xs font-normal leading-relaxed text-[var(--color-ink-muted)]">{hint}</span>}</div>;
}
export function StatusMessage({ error, message }: { error?: string; message?: string }) {
  return <>{error && <p role="alert" className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-ink)]">{error}</p>}{message && <p role="status" className="rounded-lg bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-ink)]">{message}</p>}</>;
}
export function statusLabel(status: string) { return status.replaceAll("_", " "); }
export async function supportRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers } });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "This request failed. Your draft is still here; try again when connected.");
  return value;
}
export type TicketMessage = { id: string; body: string; createdAt: string; fromSupport?: boolean; internal?: boolean; authorId?: string };
export type Ticket = { id: string; subject: string; category: string; severity: string; workflow: string; status: string; version: number; updatedAt: string; createdAt: string; description?: string; reproducibility?: string; diagnostics?: Record<string, string>; isSecurity: boolean; assigneeId?: string | null; userId?: string; orgId?: string; messages?: TicketMessage[] };
export function ConversationBody({ ticket, staff = false }: { ticket: Ticket; staff?: boolean }) {
  return <div className="space-y-4"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 capitalize">{statusLabel(ticket.status)}</span><span>{ticket.workflow}</span>{ticket.isSecurity && <span className="font-semibold">Private security report</span>}</div><div className="whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border-strong)] p-4 text-sm leading-relaxed">{ticket.description}</div>{ticket.reproducibility && <p className="whitespace-pre-wrap break-words text-sm"><strong>Reproduction: </strong>{ticket.reproducibility}</p>}{ticket.messages?.map((item) => <article key={item.id} className={`rounded-lg border p-4 ${item.internal ? "border-amber-500" : "border-[var(--color-border-strong)]"}`}><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--color-ink-muted)]"><strong className="text-[var(--color-ink)]">{item.internal ? "Internal note · staff only" : staff ? item.authorId === ticket.userId ? "Customer" : "Support" : item.fromSupport ? "Support" : "You"}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p></article>)}</div>;
}
