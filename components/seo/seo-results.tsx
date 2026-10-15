"use client";

import { useState, type FormEvent } from "react";
import { FileUp, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { displayDate, muted, selectClass, type SearchImport, type SeoAction, type SeoSite } from "./seo-workspace";

const days = (report: SearchImport) => Math.round((Date.parse(report.endDate) - Date.parse(report.startDate)) / 86_400_000) + 1;
function comparisonIssue(current: SearchImport, previous: SearchImport) {
  if (current.id === previous.id) return "Choose two different reports.";
  if (current.kind !== "totals" || previous.kind !== "totals") return "Only date-based property totals can be compared.";
  if (current.property !== previous.property) return "Choose reports for the same Search Console property.";
  if (current.searchType !== previous.searchType) return "Choose reports for the same search type.";
  if (current.completeness !== "imported_complete_dates" || previous.completeness !== "imported_complete_dates") return "A date row for every day is required in both reports.";
  if (days(current) !== days(previous)) return "Choose reporting periods of equal duration.";
  if (previous.endDate >= current.startDate) return "The previous period must end before the current period starts.";
  return "";
}
const formatCount = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : value.toLocaleString("en-GB");
const formatPercent = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : `${(value * 100).toFixed(2)}%`;
const formatPosition = (value: number | null | undefined) => value === null || value === undefined ? "Unavailable" : value.toFixed(1);

export function SeoResults({ site, imports, busy, act }: { site: SeoSite; imports: SearchImport[]; busy: boolean; act: SeoAction }) {
  const [showForm, setShowForm] = useState(!imports.length);
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [previousId, setPreviousId] = useState("");
  const totals = imports.filter((report) => report.kind === "totals");
  const current = totals.find((report) => report.id === currentId) ?? totals[0];
  const previous = totals.find((report) => report.id === previousId);
  const issue = current && previous ? comparisonIssue(current, previous) : "";
  const comparable = current && previous && !issue;
  const reportLabel = (report: SearchImport) => `${report.startDate} → ${report.endDate} · ${report.searchType} · ${report.property}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (new TextEncoder().encode(csv).byteLength > 1_000_000) { setError("Use a CSV file up to 1 MB."); return; }
    try {
      await act({ action: "import", ...Object.fromEntries(new FormData(event.currentTarget)), csv });
      setShowForm(false); setCsv(""); setFileName(""); setCurrentId(""); setPreviousId("");
    } catch (err) { setError(err instanceof Error ? err.message : "Please check your report."); }
  }
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-2xl font-semibold">Know what search is bringing you.</h2><p className={`mt-2 ${muted}`}>Your imported Search Console data, with a clear source and reporting period.</p></div><Button variant="secondary" onClick={() => setShowForm(!showForm)}><FileUp className="h-4 w-4" />{showForm ? "Close import" : "Import Search Console CSV"}</Button></div>
    {showForm && <Card><h3 className="font-display text-xl font-semibold">Bring your search data</h3><p className={`mt-2 ${muted}`}>Export a Performance report from Search Console. Import one Date, Query or Page dimension at a time, with Clicks and Impressions columns. Position is optional.</p><form onSubmit={submit} className="mt-5 space-y-4">
      <div className="space-y-1.5"><Label htmlFor="seo-import-property">Search Console property</Label><Input id="seo-import-property" name="property" required maxLength={2048} defaultValue={site.url} placeholder="sc-domain:example.com or https://example.com/" /><p className="text-xs text-[var(--color-ink-muted)]">Use the exact property covering this website.</p></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="seo-import-start">Period starts</Label><Input id="seo-import-start" type="date" name="startDate" required /></div><div className="space-y-1.5"><Label htmlFor="seo-import-end">Period ends</Label><Input id="seo-import-end" type="date" name="endDate" required /></div><div className="space-y-1.5"><Label htmlFor="seo-import-type">Search type</Label><select id="seo-import-type" name="searchType" defaultValue="web" required className={selectClass}><option value="web">Web</option><option value="image">Image</option><option value="video">Video</option><option value="news">News</option><option value="discover">Discover</option><option value="googleNews">Google News</option></select></div></div>
      <div className="space-y-1.5"><Label htmlFor="seo-import-file">Upload CSV <span className="font-normal text-[var(--color-ink-muted)]">(up to 1 MB)</span></Label><Input id="seo-import-file" type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setError(""); if (file.size > 1_000_000) { setError("Use a CSV file up to 1 MB."); event.target.value = ""; return; } try { setCsv(await file.text()); setFileName(file.name); } catch { setError("This file could not be read. Try pasting the CSV instead."); } }} />{fileName && <p className="break-words text-xs text-[var(--color-ink-muted)]">Loaded {fileName}. Review or edit the text below.</p>}</div>
      <div className="space-y-1.5"><Label htmlFor="seo-import-csv">Or paste CSV text</Label><Textarea id="seo-import-csv" required rows={6} value={csv} onChange={(event) => { setCsv(event.target.value); setFileName(""); }} maxLength={1000000} placeholder={'Date,Clicks,Impressions,Position\n…'} className="font-mono text-xs" ariaDescribedBy="seo-import-help" /><p id="seo-import-help" className="text-xs leading-relaxed text-[var(--color-ink-muted)]">Date rows support property totals. Query and page rows are breakdowns and may omit anonymised or filtered data. Keep exports consistent and unfiltered for comparisons.</p></div><FieldError message={error} /><Button type="submit" loading={busy}>Import report</Button>
    </form></Card>}
    {!current ? <Card className="py-10 text-center"><TrendingUp className="mx-auto mb-4 h-8 w-8 text-[var(--color-accent)]" aria-hidden="true" /><h3 className="font-display text-xl font-semibold">Your search baseline is waiting.</h3><p className={`mx-auto mt-2 max-w-lg ${muted}`}>Import a Date report to see property clicks, impressions, CTR and average position for a defined period. Query and Page exports stay separate below.</p></Card> : <>
      <Card><div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="seo-current-report">Current property totals report</Label><select id="seo-current-report" value={current.id} onChange={(event) => setCurrentId(event.target.value)} className={`${selectClass} mt-2`}>{totals.map((report) => <option key={report.id} value={report.id}>{reportLabel(report)}</option>)}</select></div><div><Label htmlFor="seo-previous-report">Compare with a previous period</Label><select id="seo-previous-report" value={previousId} onChange={(event) => setPreviousId(event.target.value)} className={`${selectClass} mt-2`}><option value="">No comparison</option>{totals.filter((report) => report.id !== current.id).map((report) => <option key={report.id} value={report.id}>{reportLabel(report)}</option>)}</select></div></div><p className="mt-4 break-all text-xs leading-relaxed text-[var(--color-ink-muted)]">Source: Search Console CSV · {current.property} · {current.searchType} search · {displayDate(current.startDate)} – {displayDate(current.endDate)} · Imported {displayDate(current.createdAt)}</p>{current.completeness !== "imported_complete_dates" && <div className="mt-4"><Callout tone="warning">This report has incomplete date coverage. The figures describe the supplied dates and cannot be used for period comparisons.</Callout></div>}{issue && <div className="mt-4"><Callout tone="info">{issue}</Callout></div>}</Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { key: "clicks" as const, label: "Clicks", format: formatCount },
        { key: "impressions" as const, label: "Impressions", format: formatCount },
        { key: "ctr" as const, label: "Click-through rate", format: formatPercent },
        { key: "position" as const, label: "Average position", format: formatPosition },
      ].map(({ key, label, format }) => {
        const value = current.totals[key];
        const before = comparable ? previous.totals[key] : null;
        const delta = value !== null && before !== null ? value - before : null;
        const change = delta === null ? null : key === "ctr" ? `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(2)} percentage points` : key === "position" ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} positions` : `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-GB")}`;
        return <Card key={key} className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</p><p className="mt-3 font-display text-3xl font-semibold tabular-nums">{format(value)}</p><p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-muted)]">{change ? `${change} vs previous period` : value === null ? "Not present in the imported data" : "Observed in imported date rows"}</p></Card>;
      })}</div>
      {comparable && <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">Comparison uses {days(current)} days per period, the same property and search type, with no overlapping dates. Lower average position means a higher observed ranking. Report filters and search conditions can affect changes; this does not attribute gains to an individual task.</p>}
    </>}
    {!!imports.length && <Card><h3 className="font-display text-xl font-semibold">Import history</h3><p className={`mt-1 ${muted}`}>Property totals and breakdowns are kept distinct. Values below describe each report’s supplied rows.</p><ul className="mt-4 divide-y divide-[var(--color-border)]">{imports.map((report) => <li key={report.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{report.kind === "totals" ? "Date report · property totals" : `${report.kind === "queries" ? "Query" : "Page"} breakdown · row subtotals`}</p><p className="mt-1 break-all text-xs text-[var(--color-ink-muted)]">{report.property} · {report.searchType} · {report.startDate} – {report.endDate}</p><p className="mt-1 text-xs text-[var(--color-ink-muted)]">Imported {displayDate(report.createdAt)} · {report.completeness === "imported_complete_dates" ? "Every reporting date present" : "Partial coverage"}</p></div><dl className="flex gap-5 text-sm"><div><dt className="text-xs text-[var(--color-ink-muted)]">{report.kind === "totals" ? "Clicks" : "Row clicks"}</dt><dd className="mt-1 tabular-nums">{formatCount(report.totals.clicks)}</dd></div><div><dt className="text-xs text-[var(--color-ink-muted)]">{report.kind === "totals" ? "Impressions" : "Row impressions"}</dt><dd className="mt-1 tabular-nums">{formatCount(report.totals.impressions)}</dd></div></dl></div></li>)}</ul></Card>}
  </div>;
}
