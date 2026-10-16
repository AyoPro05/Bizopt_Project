"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, FileText, Globe2, MapPin, Plus, RefreshCw, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Label } from "@/components/ui/label";
import { SeoOnboarding } from "./seo-onboarding";
import { SeoOpportunities } from "./seo-opportunities";
import { SeoContentEditor } from "./seo-content-editor";
import { SeoHealth } from "./seo-health";
import { SeoLocal } from "./seo-local";
import { SeoResults } from "./seo-results";
import styles from "./seo-workspace.module.css";

export type SeoSite = { id: string; name: string; url: string; goal: string; services: string; audience: string; locale: string; serviceAreas: string[]; localChecklist: Record<string, boolean> };
export type Opportunity = { id: string; status: string; ownerId: string | null; dueAt: string | null; payload: { title: string; keyword: string; source: string; evidence: string; reason: string; priority: string; effort: string; intent: string; score: number | null; scoreVersion: string; targetUrl: string | null; action: string; evidenceAt?: string; evidencePeriod?: { startDate: string; endDate: string; searchType: string }; outreachDraft?: string } };
export type ContentVersion = { id?: string; title: string; description: string; slug: string; version: number; source: string; body?: string; createdAt?: string };
export type ContentItem = { id: string; currentVersion: number; updatedAt: string; versions: ContentVersion[] };
export type ContentDetail = ContentItem & { brief: { audience: string; intent: string; keyword: string; targetUrl: string | null; outline: string[]; internalLinks: string[]; cta: string; claimsToVerify: string[] }; reviewNotes: string[] };
export type Finding = { code: string; severity: string; url: string; evidence: string; explanation: string; fix: string };
export type SeoAudit = { id: string; status: string; createdAt: string; finishedAt: string | null; error: string | null; result: { pages: { url: string; status: number; title: string | null; indexable: boolean }[]; findings: Finding[]; coverage: string[]; limited: boolean } | null };
export type SearchImport = { id: string; kind: string; startDate: string; endDate: string; property: string; searchType: string; completeness: string; createdAt: string; totals: { clicks: number; impressions: number; ctr: number | null; position: number | null } };
export type Workspace = { viewerId?: string; sites: SeoSite[]; site: SeoSite | null; opportunities: Opportunity[]; content: ContentItem[]; audits: SeoAudit[]; imports: SearchImport[] };
export type SeoAction = (data: Record<string, unknown>) => Promise<unknown>;

export const selectClass = "w-full min-w-0 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";
export const muted = "text-sm leading-relaxed text-[var(--color-ink-muted)]";
export function sourceLabel(source: string) { return ({ business_brief: "Business brief", search_console_import: "Search Console import", manual_prospect: "Your prospect", template: "Template draft", edited: "Human edited" } as Record<string, string>)[source] ?? source.replace(/_/g, " "); }
export function displayDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }); }
export async function seoRequest<T>(url: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({ error: "The server returned an unreadable response. Please try again." }));
  if (!response.ok) throw new Error(payload.error ?? "This action could not be completed. Please try again.");
  return payload as T;
}

const tabs = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "opportunities", label: "Opportunities", icon: Search },
  { id: "content", label: "Content", icon: FileText },
  { id: "health", label: "Site Health", icon: ShieldCheck },
  { id: "local", label: "Local Visibility", icon: MapPin },
  { id: "results", label: "Results", icon: TrendingUp },
] as const;
type Tab = typeof tabs[number]["id"];

export function SeoWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedSite, setSelectedSite] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [contentId, setContentId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const requestSequence = useRef(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get("siteId");
    const contentId = params.get("contentId");
    const initialTab = params.get("tab");
    if (siteId) setSelectedSite(siteId);
    if (contentId) setContentId(contentId);
    if (tabs.some((item) => item.id === initialTab)) setTab(initialTab as Tab);
  }, []);
  const reload = useCallback(async (siteId = selectedSite) => {
    const sequence = ++requestSequence.current;
    const data = await seoRequest<Workspace>(`/api/seo${siteId ? `?siteId=${encodeURIComponent(siteId)}` : ""}`);
    if (sequence === requestSequence.current) setWorkspace(data);
    return data;
  }, [selectedSite]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    reload().catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Could not load your workspace."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const auditPending = workspace?.audits.some((audit) => ["queued", "running"].includes(audit.status));
  useEffect(() => {
    if (!auditPending) return;
    const interval = window.setInterval(() => { reload().catch(() => { /* Keep existing data; manual refresh is available. */ }); }, 10_000);
    return () => window.clearInterval(interval);
  }, [auditPending, reload]);

  const act: SeoAction = async (data) => {
    if (!workspace?.site) throw new Error("Select a website first.");
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await seoRequest<{ ok: boolean; result: unknown }>(`/api/seo/${encodeURIComponent(workspace.site.id)}`, data);
      await reload(workspace.site.id);
      setMessage(({ plan: "Your SEO plan is ready. Review the evidence before choosing your next task.", audit: "Site audit queued. Findings will appear when the audit worker finishes.", cancel_audit: "Audit cancelled.", create_content: "Your content brief and first draft are ready.", save_content: "A new content version has been saved.", opportunity: "Opportunity updated.", local_check: "Local checklist updated.", outreach: "Prospect and outreach draft saved for your review.", import: "Search Console report imported." } as Record<string, string>)[String(data.action)] ?? "Saved.");
      return result.result;
    } catch (err) { const text = err instanceof Error ? err.message : "Please try again."; setError(text); throw err; }
    finally { setBusy(false); }
  };
  function navigate(next: Tab) {
    if (dirty && next !== "content" && !window.confirm("You have unsaved edits. Save a version before leaving to keep your changes. Leave the editor?")) return;
    setDirty(false); setTab(next); setMessage("");
  }
  async function createDraft(id: string) {
    const result = await act({ action: "create_content", opportunityId: id }) as { id: string };
    setContentId(result.id); setTab("content");
  }
  const site = workspace?.site;
  const visibleTabs = tabs.filter((item) => item.id !== "local" || !!site?.serviceAreas.length);
  useEffect(() => {
    if (site && tab === "local" && !site.serviceAreas.length) setTab("overview");
  }, [site, tab]);

  return <div className={`${styles.workspace} min-w-0 space-y-6 text-[var(--color-ink)]`}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]"><Compass className="h-4 w-4" aria-hidden="true" /> Search, with purpose</p>
        <h1 className="font-display text-balance text-3xl font-semibold sm:text-4xl">SEO Intelligence</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">Turn your expertise into useful pages, local visibility and measurable search progress.</p>
      </div>
      <Link href="/integrations#seo" className="rounded-lg px-2 py-2 text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">Data & integrations <span aria-hidden="true">↗</span></Link>
    </header>

    {error && <Callout tone="danger" title="Action needs attention" action={<Button size="sm" variant="ghost" onClick={() => setError("")}>Dismiss</Button>}>{error}</Callout>}
    {message && <Callout tone="success">{message}</Callout>}

    {loading && !workspace ? <Card aria-busy="true"><p className={muted}>Loading your SEO workspace…</p></Card> : !workspace && error ? <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setLoading(true); reload().catch((err: Error) => setError(err.message)).finally(() => setLoading(false)); }}>Try loading again</Button>{selectedSite && <Button variant="ghost" onClick={() => setSelectedSite("")}>Open first website</Button>}</div> : null}

    {workspace && (adding || !site) ? <SeoOnboarding busy={busy} canCancel={!!site} onCancel={() => setAdding(false)} onSubmit={async (data) => {
      setBusy(true); setError("");
      try { const created = await seoRequest<{ ok: true; result: { id: string } }>("/api/seo", data); const id = created.result.id; setAdding(false); setContentId(null); setSelectedSite(id); if (id === selectedSite) await reload(id); }
      catch (err) { const text = err instanceof Error ? err.message : "Could not add this website."; setError(text); throw err; } finally { setBusy(false); }
    }} /> : null}

    {workspace && site && !adding && <>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-card)] p-4">
        <div className="w-full min-w-0 sm:w-auto sm:min-w-64"><Label htmlFor="seo-site">Website workspace</Label><select id="seo-site" value={site.id} className={`${selectClass} mt-1`} disabled={busy} onChange={(event) => { if (dirty && !window.confirm("Leave unsaved edits? Save a version before leaving to keep your changes.")) return; setDirty(false); setContentId(null); setTab("overview"); setSelectedSite(event.target.value); }}>
          {workspace.sites.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.url}</option>)}
        </select></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy || loading} ariaLabel="Refresh SEO workspace" onClick={() => { setError(""); reload().catch((err: Error) => setError(err.message)); }}><RefreshCw className="h-4 w-4" /> Refresh</Button><Button size="sm" variant="secondary" disabled={busy || workspace.sites.length >= 10} onClick={() => { if (dirty && !window.confirm("Leave the editor? Save a version before leaving to keep your changes.")) return; setDirty(false); setAdding(true); }}><Plus className="h-4 w-4" /> Add website</Button></div>
      </div>
      <nav aria-label="SEO sections" className="flex gap-1 overflow-x-auto border-b border-[var(--color-border-strong)] pb-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => navigate(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${tab === id ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"}`}><Icon className="h-4 w-4" aria-hidden="true" />{label}</button>)}
      </nav>
      <section aria-label={visibleTabs.find((item) => item.id === tab)?.label} className="animate-fade-in min-w-0">
        {tab === "overview" && <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Card className="relative overflow-hidden border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] sm:p-8"><div className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" /> Your next move</div><h2 className="max-w-lg font-display text-balance text-2xl font-semibold sm:text-3xl">{workspace.opportunities.length ? "Make the next useful page." : "Start with a clear search plan."}</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-ink-muted)]">{workspace.opportunities.length ? "Choose an opportunity, check its evidence, then shape a draft around the questions your customers really ask." : "Use your services, audience and real service areas to build a practical list of content opportunities. Add Search Console data as you learn."}</p><div className="mt-6 flex flex-wrap gap-3"><Button loading={busy} onClick={() => void act({ action: "plan" }).catch(() => undefined)}>Create SEO plan <ArrowRight className="h-4 w-4" /></Button>{workspace.opportunities.length > 0 && <Button variant="secondary" onClick={() => navigate("opportunities")}>Review opportunities</Button>}</div></Card>
            <Card><div className="flex items-center gap-2 text-[var(--color-accent)]"><Globe2 className="h-5 w-5" aria-hidden="true" /><h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">The business behind the search</h2></div><p className="mt-4 text-sm font-medium">{site.goal}</p><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Audience</dt><dd className="mt-1">{site.audience}</dd></div><div><dt className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">Coverage · {site.locale}</dt><dd className="mt-1">{site.serviceAreas.length ? site.serviceAreas.join(", ") : "No local service areas supplied"}</dd></div></dl><a href={site.url} target="_blank" rel="noopener noreferrer" className="mt-4 block break-all text-sm text-[var(--color-accent)] underline-offset-4 hover:underline">{site.url} <span aria-hidden="true">↗</span></a></Card>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">{[
            { label: "Open opportunities", value: String(workspace.opportunities.filter((item) => item.status === "open").length), note: "Tasks in your workspace", go: "opportunities" as Tab },
            { label: "Content in progress", value: String(workspace.content.length), note: "Saved, versioned drafts", go: "content" as Tab },
            { label: "Latest site audit", value: workspace.audits[0]?.status.replace(/_/g, " ") ?? "Not run", note: workspace.audits[0] ? displayDate(workspace.audits[0].createdAt) : "Inspect a bounded sample of public HTML", go: "health" as Tab },
          ].map((item) => <button key={item.label} onClick={() => navigate(item.go)} className="card-panel min-w-0 break-words p-5 text-left transition-colors hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"><p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{item.label}</p><p className="mt-3 font-display text-2xl font-semibold capitalize">{item.value}</p><p className="mt-1 text-xs text-[var(--color-ink-muted)]">{item.note}</p></button>)}</div>
          <Card className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-lg font-semibold">Give your decisions a measured baseline.</h2><p className={`mt-1 ${muted}`}>Import a Search Console export to see observed search performance for this website.</p></div><Button variant="secondary" onClick={() => navigate("results")}>Open Results <ArrowRight className="h-4 w-4" /></Button></Card>
        </div>}
        {tab === "opportunities" && <SeoOpportunities viewerId={workspace.viewerId} opportunities={workspace.opportunities} busy={busy} act={act} createDraft={createDraft} />}
        {tab === "content" && <SeoContentEditor key={site.id} site={site} items={workspace.content} selectedId={contentId} onSelect={setContentId} onDirty={setDirty} busy={busy} act={act} onFindOpportunity={() => navigate("opportunities")} />}
        {tab === "health" && <SeoHealth audits={workspace.audits} busy={busy} act={act} />}
        {tab === "local" && site.serviceAreas.length > 0 && <SeoLocal site={site} busy={busy} act={act} />}
        {tab === "results" && <SeoResults site={site} imports={workspace.imports} busy={busy} act={act} />}
      </section>
    </>}
  </div>;
}
