"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";

export function SeoOnboarding({ busy, canCancel, onCancel, onSubmit }: { busy: boolean; canCancel: boolean; onCancel: () => void; onSubmit: (data: Record<string, unknown>) => Promise<void> }) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());
    const serviceAreas = String(data.serviceAreas ?? "").split(",").map((area) => area.trim()).filter(Boolean);
    if (serviceAreas.length > 20) { setError("Add up to 20 service areas."); return; }
    try { await onSubmit({ ...data, serviceAreas, authorised: form.get("authorised") === "on" }); }
    catch (err) { setError(err instanceof Error ? err.message : "Please check your website details."); }
  }
  return <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
    <div className="rounded-2xl border border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)] p-6 sm:p-8"><Globe2 className="mb-8 h-8 w-8 text-[var(--color-accent)]" aria-hidden="true" /><p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-accent)]">01 · Your foundation</p><h2 className="mt-3 font-display text-balance text-3xl font-semibold">Better visibility starts with your business.</h2><p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-muted)]">Tell us what you offer and who you want to reach. This brief grounds your content plan in real services and useful customer questions.</p><ol className="mt-8 space-y-5 text-sm">{["Build a focused SEO plan", "Create and refine useful content", "Measure search progress with your data"].map((text, index) => <li key={text} className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-muted)] text-xs text-[var(--color-accent)]">{index + 1}</span><span className="pt-0.5">{text}</span></li>)}</ol></div>
    <Card><h2 className="font-display text-xl font-semibold">Add a website</h2><p className="mt-1 text-sm text-[var(--color-ink-muted)]">Required fields help keep your recommendations relevant.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" aria-describedby={error ? "seo-onboarding-error" : undefined}>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="seo-name">Business or website name</Label><Input id="seo-name" name="name" required maxLength={120} autoComplete="organization" placeholder="Your business" /></div><div className="space-y-1.5"><Label htmlFor="seo-url">Website URL</Label><Input id="seo-url" name="url" type="url" required maxLength={2048} placeholder="https://yourwebsite.co.uk" /><p className="text-xs text-[var(--color-ink-muted)]">HTTPS; public website or a specific site section.</p></div></div>
        <div className="space-y-1.5"><Label htmlFor="seo-goal">What should better visibility achieve?</Label><Textarea id="seo-goal" name="goal" rows={2} required maxLength={500} placeholder="More enquiries from customers looking for…" /></div>
        <div className="space-y-1.5"><Label htmlFor="seo-services">Services or products</Label><Textarea id="seo-services" name="services" rows={2} required maxLength={1500} placeholder="List your main services, separated by commas" /></div>
        <div className="space-y-1.5"><Label htmlFor="seo-audience">Who are your customers?</Label><Input id="seo-audience" name="audience" required maxLength={500} placeholder="For example, independent retailers and local service businesses" /></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]"><div className="space-y-1.5"><Label htmlFor="seo-locale">Language & region</Label><Input id="seo-locale" name="locale" required maxLength={35} defaultValue="en-GB" /></div><div className="space-y-1.5"><Label htmlFor="seo-areas">Service areas <span className="font-normal text-[var(--color-ink-muted)]">(optional)</span></Label><Input id="seo-areas" name="serviceAreas" maxLength={2400} placeholder="Bristol, Bath, South Gloucestershire" /><p className="text-xs text-[var(--color-ink-muted)]">Comma separated. Add the places you actually serve.</p></div></div>
        <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4"><label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="authorised" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]" /><span>I own this website or have permission to inspect its public pages. I authorise a limited public HTML audit.</span></label></div>
        <FieldError id="seo-onboarding-error" message={error} />
        <div className="flex flex-wrap justify-end gap-2">{canCancel && <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>}<Button type="submit" loading={busy}>Create website workspace <ArrowRight className="h-4 w-4" /></Button></div>
      </form>
    </Card>
  </div>;
}
