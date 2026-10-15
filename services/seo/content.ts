import { z } from "zod";
import type { SeoSiteBrief } from "./planning";

const text = z.string().trim().min(1).max(10_000);
const briefSchema = z.object({
  audience: text,
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  keyword: text,
  targetUrl: z.string().url().nullable(),
  outline: z.array(text).min(4).max(12),
  internalLinks: z.array(z.string().url()).max(10),
  cta: text,
  claimsToVerify: z.array(text).min(1).max(12),
}).strict();

export type ContentBrief = z.infer<typeof briefSchema>;
export type ContentDraft = { title: string; description: string; slug: string; body: string; source: "template"; reviewNotes: string[] };
type ContentFields = Pick<ContentDraft, "title" | "description" | "body">;

function siteUrl(raw: string): URL {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use a public HTTP or HTTPS website URL.");
  return url;
}

export function createContentBrief(site: SeoSiteBrief, opportunity: { title: string; keyword: string; intent: string; targetUrl: string | null; evidence: string }): ContentBrief {
  const url = siteUrl(site.url);
  const keyword = text.parse(opportunity.keyword);
  if (opportunity.targetUrl && siteUrl(opportunity.targetUrl).origin !== url.origin) throw new Error("The target page must belong to this website.");
  return briefSchema.parse({
    audience: site.audience,
    intent: opportunity.intent,
    keyword,
    targetUrl: opportunity.targetUrl,
    outline: [
      `What ${site.audience} need to know about ${keyword}`,
      "What the service includes and who it is suitable for",
      "How to compare options, costs and practical considerations",
      ...(site.serviceAreas.length ? [`Availability and useful local details for ${site.serviceAreas.join(", ")}`] : []),
      "Answers to common customer questions",
      "How to take the next step",
    ],
    // Only the supplied website URL is known. Do not invent /services or /contact.
    internalLinks: [url.href],
    cta: `Invite ${site.audience} to enquire about ${site.services}; add a verified contact or booking method.`,
    claimsToVerify: [
      "Verify service area coverage, qualifications, insurance and availability with the business owner.",
      "Verify prices, testimonials, results and any comparison claims before publication.",
      "Check the existing website for a page with the same intent and use one canonical target.",
      `Check the opportunity evidence before making claims: ${opportunity.evidence || "No measured search evidence supplied."}`,
    ],
  });
}

export function draftFromBrief(site: SeoSiteBrief, input: ContentBrief): ContentDraft {
  siteUrl(site.url);
  const brief = briefSchema.parse(input);
  const title = (brief.keyword.charAt(0).toUpperCase() + brief.keyword.slice(1)).slice(0, 200);
  const slug = brief.keyword.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/g, "") || "content-draft";
  return {
    title,
    description: `Explore ${brief.keyword}: practical questions, service details and next steps for ${brief.audience}.`.slice(0, 160),
    slug,
    body: [
      `# ${title}`,
      `Draft template for ${brief.audience}. [VERIFY: Replace this introduction with an accurate explanation of the business's service and the reader's need.]`,
      ...brief.outline.flatMap((heading) => [`## ${heading}`, `[VERIFY: Add useful, original information for this section. Confirm all business facts, prices, qualifications, locations and availability before publishing.]`]),
      `## Next step\n${brief.cta}\n[VERIFY: Add the correct contact details or booking link and check it works.]`,
    ].join("\n\n"),
    source: "template",
    reviewNotes: [
      "This is a deterministic template, not researched or AI-generated factual copy. Replace every [VERIFY: ...] placeholder before publishing.",
      "Review accuracy, usefulness, accessibility and the existing target page before exporting or publishing.",
      ...brief.claimsToVerify,
    ],
  };
}

export function reviewContent(content: ContentFields, keyword: string): string[] {
  const notes: string[] = [];
  if (!content.title.trim()) notes.push("Add a descriptive page title.");
  else if (content.title.length > 65) notes.push("Consider shortening the title for clarity; search display length varies.");
  if (!content.description.trim()) notes.push("Add a useful meta description.");
  else if (content.description.length > 170) notes.push("Consider shortening the description; search display length varies.");
  if (!content.body.trim()) notes.push("Add useful content that answers the visitor's question.");
  if (/\[VERIFY:|\[TODO:|\bTBD\b/i.test(content.body)) notes.push("Replace all factual placeholders and verify the supporting evidence before publication.");
  if (/<\/?[a-z][^>]*>|\]\(\s*(?:javascript|data):/i.test(content.body)) notes.push("Remove or review raw HTML and unsafe link markup before publication.");
  if (/guarantee(?:d)?\s+(?:#?1|first|rankings?|results?)|guarantee(?:d)?\s+\d+\s*%/i.test(content.body)) notes.push("Remove unsupported ranking or results guarantees; verify every claim.");
  const term = keyword.trim().toLowerCase();
  if (term) {
    if (!content.title.toLowerCase().includes(term)) notes.push("Consider the target keyword in the title where it reads naturally.");
    const body = content.body.toLowerCase();
    const occurrences = body.split(term).length - 1;
    const words = content.body.trim().split(/\s+/).filter(Boolean).length;
    if (occurrences > 5 && occurrences / Math.max(words, 1) > 0.05) notes.push("Potential keyword overuse: rewrite repeated phrases naturally; avoid keyword stuffing.");
  }
  return notes;
}

/** Downloadable text only. Escapes raw HTML; no rendering or publication occurs. */
export function exportMarkdown(content: Pick<ContentDraft, "title" | "description" | "slug" | "body">): string {
  const body = content.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return ["---", `title: ${JSON.stringify(content.title)}`, `description: ${JSON.stringify(content.description)}`, `slug: ${JSON.stringify(content.slug)}`, "---", "", body, ""].join("\n");
}
