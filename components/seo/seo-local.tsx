"use client";

import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { muted, type SeoSite, type SeoAction } from "./seo-workspace";

const checks = [
  { key: "profile", title: "Claim and verify your Business Profile", detail: "Use your real business name and an eligible location or service area." },
  { key: "contact", title: "Keep contact details consistent", detail: "Compare business name, address where applicable, phone and website across your site and trusted listings." },
  { key: "hours", title: "Confirm opening and holiday hours", detail: "Keep your real availability current so customers know when to contact you." },
  { key: "categories", title: "Choose accurate categories and services", detail: "Describe the services you actually provide; select the most relevant primary category." },
  { key: "service_areas", title: "Confirm the areas you actually serve", detail: "Avoid invented offices and duplicate location pages with no useful local information." },
  { key: "reviews", title: "Invite honest customer feedback", detail: "Ask customers consistently, without incentives or filtering out negative feedback." },
  { key: "landing_page", title: "Make your local landing page useful", detail: "Explain your real services, coverage, contact options and verified local evidence." },
] as const;

export function SeoLocal({ site, busy, act }: { site: SeoSite; busy: boolean; act: SeoAction }) {
  const completed = checks.filter((check) => site.localChecklist?.[check.key]).length;
  return <div className="space-y-5"><div><h2 className="font-display text-2xl font-semibold">Be easy to find. Be useful nearby.</h2><p className={`mt-2 ${muted}`}>Keep your business information accurate wherever local customers look.</p></div><Card className="border-[var(--color-accent-muted)] bg-[var(--color-accent-soft)]"><div className="flex items-start gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" /><div><p className="text-xs font-medium uppercase tracking-wide text-[var(--color-accent)]">Your real service areas</p><p className="mt-2 font-display text-xl font-semibold">{site.serviceAreas.join(" · ")}</p><p className="mt-2 text-xs text-[var(--color-ink-muted)]">Source: your business brief · {completed} of {checks.length} manual checks complete</p></div></div></Card><Callout tone="info" title="A checklist you control">These checks record your own review. Business Profile data, local pack rankings and review monitoring need a connected provider.</Callout><Card className="p-0"><ul className="divide-y divide-[var(--color-border)]">{checks.map((check, index) => <li key={check.key} className="p-5"><label className="flex cursor-pointer items-start gap-4"><input type="checkbox" checked={!!site.localChecklist?.[check.key]} disabled={busy} onChange={(event) => void act({ action: "local_check", key: check.key, checked: event.target.checked }).catch(() => undefined)} className="mt-1 h-5 w-5 shrink-0 rounded accent-[var(--color-accent)]" /><span className="min-w-0"><span className="mr-2 text-xs tabular-nums text-[var(--color-ink-muted)]">0{index + 1}</span><span className="text-sm font-medium">{check.title}</span><span className="mt-1 block text-sm leading-relaxed text-[var(--color-ink-muted)]">{check.detail}</span></span></label></li>)}</ul></Card></div>;
}
