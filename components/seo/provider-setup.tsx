import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SEO_PROVIDERS } from "@/services/seo/providers";

export function SeoProviderSetup() {
  return <section id="seo" className="mt-10 scroll-mt-6" aria-labelledby="seo-integrations-title">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="seo-integrations-title" className="font-display text-xl font-semibold">SEO connections</h2><p className="mt-1 text-sm text-[var(--color-ink-muted)]">Start with your website and exported search data.</p></div>
      <Link href="/seo" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]">Open SEO <ArrowUpRight className="h-4 w-4" /></Link>
    </div>
    <div className="grid gap-3 md:grid-cols-2">{SEO_PROVIDERS.map((provider) => <Card key={provider.id}>
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-medium">{provider.name}</h3><span className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)]">{provider.status === "manual" ? "Manual workflow" : "Unavailable"}</span></div>
      <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{provider.reason}</p>
      <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-accent)]">Provider setup guide <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
    </Card>)}</div>
  </section>;
}
