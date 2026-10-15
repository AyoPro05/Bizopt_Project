"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAccount } from "@/components/account/account-provider";
import Link from "next/link";
import { Download, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { displayDate, muted, selectClass, seoRequest, sourceLabel, type ContentDetail, type ContentItem, type ContentVersion, type SeoAction, type SeoSite } from "./seo-workspace";

type Fields = { title: string; description: string; slug: string; body: string };
const fieldsFrom = (version: ContentVersion): Fields => ({ title: version.title, description: version.description, slug: version.slug, body: version.body ?? "" });
const empty: Fields = { title: "", description: "", slug: "", body: "" };
function validFields(value: unknown): value is Fields { return !!value && typeof value === "object" && ["title", "description", "slug", "body"].every((key) => typeof (value as Record<string, unknown>)[key] === "string"); }

export function SeoContentEditor({ site, items, selectedId, onSelect, onDirty, busy, act, onFindOpportunity }: { site: SeoSite; items: ContentItem[]; selectedId: string | null; onSelect: (id: string) => void; onDirty: (dirty: boolean) => void; busy: boolean; act: SeoAction; onFindOpportunity: () => void }) {
  const { account, loading: accountLoading } = useAccount();
  const recoveryAllowed = account?.preferences.localDraftRecovery === true;
  const recoveryPermission = useRef(recoveryAllowed);
  recoveryPermission.current = recoveryAllowed;
  const id = selectedId ?? items[0]?.id ?? "";
  const listVersion = items.find((item) => item.id === id)?.currentVersion;
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovered, setRecovered] = useState(false);
  const [olderRecovery, setOlderRecovery] = useState<Fields | null>(null);
  const [compare, setCompare] = useState("");
  const [retry, setRetry] = useState(0);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const loadedKey = useRef("");
  const storageKey = `bizopt:seo:${account?.user.id ?? "anonymous"}:${site.id}:${id}`;
  const current = detail?.versions[0];
  const dirty = !!current && JSON.stringify(fields) !== JSON.stringify(fieldsFrom(current));

  useEffect(() => {
    if (!id || accountLoading) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setRecovered(false); setOlderRecovery(null); setCompare(""); loadedKey.current = "";
    setDetail((previous) => previous?.id === id ? previous : null);
    seoRequest<ContentDetail>(`/api/seo/${encodeURIComponent(site.id)}/content/${encodeURIComponent(id)}`, undefined, controller.signal).then((data) => {
      const version = data.versions[0];
      if (!version) throw new Error("This content has no saved version.");
      setDetail(data);
      let next = fieldsFrom(version);
      try {
        const raw = recoveryPermission.current ? localStorage.getItem(storageKey) : null;
        if (raw) { const saved: unknown = JSON.parse(raw); if (saved && typeof saved === "object" && "fields" in saved && validFields(saved.fields)) { if ("expectedVersion" in saved && saved.expectedVersion === data.currentVersion) { next = saved.fields; setRecovered(JSON.stringify(next) !== JSON.stringify(fieldsFrom(version))); } else { setOlderRecovery(saved.fields); } } }
      } catch { setStorageUnavailable(true); }
      setFields(next); loadedKey.current = storageKey;
    }).catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load this draft."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, site.id, storageKey, listVersion, retry, accountLoading]);

  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => {
    if (!detail || loadedKey.current !== storageKey) return;
    try { if (!recoveryAllowed) { localStorage.removeItem(storageKey); setOlderRecovery(null); setRecovered(false); } else if (dirty) localStorage.setItem(storageKey, JSON.stringify({ expectedVersion: detail.currentVersion, fields })); else if (!olderRecovery) localStorage.removeItem(storageKey); }
    catch { setStorageUnavailable(true); }
  }, [fields, dirty, detail, storageKey, olderRecovery, recoveryAllowed]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(key: keyof Fields, value: string) { setFields((old) => ({ ...old, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!detail || detail.id !== id || !dirty) return;
    try {
      await act({ action: "save_content", contentId: id, expectedVersion: detail.currentVersion, ...fields });
      try { localStorage.removeItem(storageKey); } catch { /* The server version is already saved. */ }
      setRecovered(false); setOlderRecovery(null); setRetry((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Your draft could not be saved."); }
  }
  const previous = detail?.versions.find((version) => String(version.version) === compare);

  if (!items.length) return <Card className="py-12 text-center"><FileText className="mx-auto mb-4 h-8 w-8 text-[var(--color-accent)]" aria-hidden="true" /><h2 className="font-display text-2xl font-semibold">From opportunity to useful content.</h2><p className={`mx-auto mt-3 max-w-lg ${muted}`}>Choose an opportunity to create a brief and a template draft. Add your expertise, verify the details, and save versions as you refine.</p><Button className="mt-5" onClick={onFindOpportunity}>Find a content opportunity</Button></Card>;
  return <div className="min-w-0 space-y-5"><div><h2 className="font-display text-2xl font-semibold">Make it worth reading.</h2><p className={`mt-2 ${muted}`}>Bring your knowledge to the draft. Keep every claim useful, specific and verifiable.</p></div><div className="max-w-2xl"><Label htmlFor="seo-content-select">Content draft</Label><select id="seo-content-select" value={id} disabled={busy} className={`${selectClass} mt-1.5`} onChange={(event) => { if (dirty && !window.confirm("Open another draft? Save a version before leaving to keep your changes.")) return; onSelect(event.target.value); }}>{items.map((item) => <option key={item.id} value={item.id}>{item.versions[0]?.title ?? "Untitled draft"} · v{item.currentVersion}</option>)}</select></div>
    {error && <Callout tone="danger" title="Draft needs attention" action={<Button size="sm" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Reload</Button>}>{error} Unsaved text is kept in this editor.</Callout>}
    {loading ? <Card aria-busy="true"><p className={muted}>Loading saved versions…</p></Card> : detail && current && <>
      {!recoveryAllowed && <Callout tone="info">Local draft recovery is off. Save versions to keep your work, or enable recovery on this device in <Link href="/settings" className="underline">account settings</Link>.</Callout>}
      {recovered && <Callout tone="info">Recovered your unsaved edits from this browser. Review and save them when ready.</Callout>}
      {storageUnavailable && <Callout tone="warning">Local draft recovery is unavailable in this browser. Save a version before leaving.</Callout>}
      {olderRecovery && <Card className="border-[var(--color-warning-border)]"><h3 className="font-display text-lg font-semibold">An earlier unsaved draft is available</h3><p className={`mt-2 ${muted}`}>A newer version has been saved since these local edits. Review the local copy before replacing current text.</p><details className="mt-3"><summary className="cursor-pointer text-sm text-[var(--color-accent)]">Review local recovery copy</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface)] p-3 text-xs">{olderRecovery.title}{"\n\n"}{olderRecovery.description}{"\n\n"}{olderRecovery.slug}{"\n\n"}{olderRecovery.body}</pre></details><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => { setFields(olderRecovery); setOlderRecovery(null); setRecovered(true); }}>Use local copy in current editor</Button><Button size="sm" variant="ghost" onClick={() => { setOlderRecovery(null); try { localStorage.removeItem(storageKey); } catch { /* Optional recovery only. */ } }}>Discard local copy</Button></div></Card>}
      <Card><details open><summary className="cursor-pointer rounded font-display text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">The brief · {detail.brief.keyword}</summary><div className="mt-4 grid gap-5 text-sm lg:grid-cols-2"><div><p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Reader & intent</p><p className="mt-1">{detail.brief.audience} · {detail.brief.intent}</p><p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Suggested outline</p><ol className="mt-2 list-inside list-decimal space-y-1.5 text-[var(--color-ink-muted)]">{detail.brief.outline.map((line) => <li key={line}>{line}</li>)}</ol></div><div><p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">Verify before publication</p><ul className="mt-2 space-y-2 leading-relaxed text-[var(--color-ink-muted)]">{detail.brief.claimsToVerify.map((claim) => <li key={claim}>· {claim}</li>)}</ul><p className="mt-4 text-sm">{detail.brief.cta}</p><p className="mt-3 text-xs text-[var(--color-ink-muted)]">Target page: {detail.brief.targetUrl ?? "Review existing pages before choosing a target"}</p></div></div></details></Card>
      <form onSubmit={save} className="min-w-0 space-y-5"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl font-semibold">Current draft</h3><p className="mt-1 text-xs text-[var(--color-ink-muted)]">Saved v{detail.currentVersion} · {sourceLabel(current.source)}{current.createdAt ? ` · ${displayDate(current.createdAt)}` : ""}</p></div><span aria-live="polite" className={`text-xs ${dirty ? "text-[var(--color-warning-fg)]" : "text-[var(--color-ink-muted)]"}`}>{dirty ? "Unsaved edits" : "Saved version"}</span></div><div className="mt-5 space-y-4"><div className="space-y-1.5"><Label htmlFor="seo-content-title">Page title</Label><Input id="seo-content-title" value={fields.title} onChange={(event) => change("title", event.target.value)} required maxLength={200} /><p className="text-xs text-[var(--color-ink-muted)]">{fields.title.length} characters · use a clear, accurate title</p></div><div className="space-y-1.5"><Label htmlFor="seo-content-description">Meta description</Label><Textarea id="seo-content-description" value={fields.description} onChange={(event) => change("description", event.target.value)} rows={2} maxLength={500} /><p className="text-xs text-[var(--color-ink-muted)]">{fields.description.length} characters · preview text may differ in search results</p></div><div className="space-y-1.5"><Label htmlFor="seo-content-slug">URL slug</Label><Input id="seo-content-slug" value={fields.slug} onChange={(event) => change("slug", event.target.value)} required maxLength={150} pattern="[a-z0-9]+(-[a-z0-9]+)*" ariaDescribedBy="seo-slug-help" /><p id="seo-slug-help" className="text-xs text-[var(--color-ink-muted)]">Lowercase words separated by hyphens.</p></div></div></Card>
        <div className={`grid min-w-0 gap-5 ${previous ? "xl:grid-cols-2" : ""}`}><Card className="min-w-0"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><Label htmlFor="seo-content-body">Article · Markdown</Label><span className="text-xs tabular-nums text-[var(--color-ink-muted)]">{fields.body.trim().split(/\s+/).filter(Boolean).length} words</span></div><Textarea id="seo-content-body" value={fields.body} onChange={(event) => change("body", event.target.value)} rows={24} required maxLength={100000} className="min-h-96 resize-y font-mono text-xs leading-7" /></Card>{previous && <Card className="min-w-0"><h3 className="font-display text-lg font-semibold">Saved version {previous.version} · read only</h3><p className="mt-1 text-xs text-[var(--color-ink-muted)]">{sourceLabel(previous.source)}{previous.createdAt ? ` · ${displayDate(previous.createdAt)}` : ""}</p><p className="mt-4 text-sm font-medium">{previous.title}</p><p className={`mt-2 ${muted}`}>{previous.description}</p><p className="mt-2 break-all text-xs text-[var(--color-accent)]">/{previous.slug}</p><pre className="mt-4 max-h-[650px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface)] p-4 font-mono text-xs leading-7">{previous.body}</pre></Card>}</div>
        <Card><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-display text-lg font-semibold">Review notes</h3><p className="mt-1 text-xs text-[var(--color-ink-muted)]">Checks on saved v{detail.currentVersion}; save to refresh.</p>{detail.reviewNotes.length ? <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{detail.reviewNotes.map((note) => <li key={note}>· {note}</li>)}</ul> : <p className={`mt-3 ${muted}`}>No automated review notes for this saved version. Verify the business details before publication.</p>}</div><div><Label htmlFor="seo-compare">Compare with an older saved version</Label><select id="seo-compare" value={compare} onChange={(event) => setCompare(event.target.value)} className={`${selectClass} mt-2`}><option value="">Hide comparison</option>{detail.versions.slice(1).map((version) => <option key={version.version} value={String(version.version)}>Version {version.version} · {sourceLabel(version.source)}</option>)}</select><p className="mt-3 text-xs leading-relaxed text-[var(--color-ink-muted)]">Saved versions are immutable. Export downloads the latest saved version as Markdown for your publishing workflow.</p></div></div><FieldError message={error} /><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4"><p className="text-xs text-[var(--color-ink-muted)]">{dirty ? "Save your edits to include them in the export." : "Ready for your review and publishing workflow."}</p><div className="flex flex-wrap gap-2">{dirty || busy ? <Button type="button" variant="secondary" disabled><Download className="h-4 w-4" /> Export saved version</Button> : <a href={`/api/seo/${encodeURIComponent(site.id)}/content/${encodeURIComponent(id)}?export=1`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"><Download className="h-4 w-4" /> Export saved version</a>}<Button type="submit" loading={busy} disabled={!dirty}><Save className="h-4 w-4" /> Save version</Button></div></div></Card>
      </form>
    </>}
  </div>;
}
