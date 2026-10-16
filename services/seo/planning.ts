export type SeoSiteBrief = {
  url: string;
  goal: string;
  services: string;
  audience: string;
  locale: string;
  serviceAreas: string[];
};

export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational";

export function classifySearchIntent(query: string): { intent: SearchIntent; confidence: "low" | "medium"; reason: string } {
  const term = query.trim().toLowerCase();
  const patterns: [SearchIntent, RegExp, string][] = [
    ["navigational", /\b(login|log in|sign in|official website)\b|\b[a-z0-9-]+\.(com|co\.uk|org|net)\b/, "website or account navigation wording"],
    ["informational", /\b(how|what|why|when|guide|tutorial|checklist)\b/, "question or learning wording"],
    ["transactional", /\b(buy|book|hire|order|quote|appointment|near me|emergency)\b/, "booking, purchase or immediate local need wording"],
    ["commercial", /\b(best|compare|comparison|review|reviews|cost|price|pricing|versus|vs)\b/, "comparison or purchase research wording"],
  ];
  for (const [intent, pattern, reason] of patterns) {
    if (pattern.test(term)) return { intent, confidence: "medium", reason: `Heuristic: ${reason}; verify against the actual search results.` };
  }
  return { intent: "commercial", confidence: "low", reason: "Heuristic: ambiguous service or topic wording; inspect search results to confirm intent." };
}

export type SeoOpportunity = {
  key: string;
  title: string;
  keyword: string;
  intent: SearchIntent;
  source: "business_brief" | "search_console_import";
  evidence: string;
  reason: string;
  effort: "small" | "medium" | "large";
  priority: "high" | "medium" | "low";
  score: number;
  scoreVersion: string;
  targetUrl: string | null;
  action: "create" | "refresh";
  volume: null;
  difficulty: null;
};

type QueryEvidence = { query: string; clicks: number; impressions: number; position: number };
const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const canonical = (value: string) => clean(value).toLowerCase();

export function planOpportunities(site: SeoSiteBrief, queries: QueryEvidence[] = []): SeoOpportunity[] {
  const opportunities = new Map<string, SeoOpportunity>();
  const add = (keyword: string, source: SeoOpportunity["source"], score: number, evidence: string, explanation: string) => {
    keyword = clean(keyword);
    if (!keyword) return;
    const key = canonical(keyword);
    if (opportunities.has(key)) return;
    const classification = classifySearchIntent(keyword);
    opportunities.set(key, {
      key,
      keyword,
      title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      intent: classification.intent,
      source,
      evidence,
      reason: `Heuristic score ${score}/100: ${explanation} Intent has ${classification.confidence} confidence. ${classification.reason} This is a prioritisation aid, not a traffic forecast. Check for an existing page serving this intent, and refresh it instead of creating a competing page. Query-only evidence cannot identify the target URL.`,
      effort: "medium",
      priority: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
      score,
      scoreVersion: "seo-opportunity-v1",
      targetUrl: null,
      action: "create",
      volume: null,
      difficulty: null,
    });
  };
  // Imported property queries take precedence over matching business suggestions.
  for (const query of [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, 100)) {
    if (!query.query.trim() || !Number.isSafeInteger(query.clicks) || !Number.isSafeInteger(query.impressions) || query.clicks < 0 || query.impressions <= 0 || query.clicks > query.impressions || !Number.isFinite(query.position) || query.position < 1) continue;
    const ranking = query.position >= 4 && query.position <= 20 ? 25 : query.position <= 3 ? 5 : 0;
    const exposure = query.impressions >= 100 ? 15 : query.impressions >= 10 ? 8 : 0;
    const lowCtr = query.clicks / query.impressions < 0.03 ? 10 : 0;
    const score = 40 + ranking + exposure + lowCtr;
    add(query.query, "search_console_import", score, `Imported query rows only: ${query.impressions} impressions, ${query.clicks} clicks, average position ${query.position}. These impressions are not monthly search volume or property totals.`, `40 baseline + ${ranking} for ranking position + ${exposure} for observed impressions + ${lowCtr} for CTR below 3%. CTR is a screening signal and varies with search intent and position.`);
  }
  const services = [...new Set(site.services.split(/[,;\n]+/).map(clean).filter(Boolean))].slice(0, 5);
  const areas = [...new Set(site.serviceAreas.map(clean).filter(Boolean))];
  for (const service of services) {
    const evidence = `Business brief: service "${service}", audience "${site.audience}", goal "${site.goal}", locale "${site.locale}"${areas.length ? `, service areas "${areas.join(", ")}"` : ""}. Search demand has not been measured.`;
    add(`${service}${areas[0] ? ` ${areas[0]}` : ""}`, "business_brief", areas.length ? 60 : 50, evidence, `40 baseline + ${areas.length ? 20 : 10} for alignment with the supplied service${areas.length ? " and local service area" : ""}. Confirm actual coverage and add useful local evidence; consolidate nearby areas on one useful page where appropriate.`);
    add(`${service} pricing`, "business_brief", 55, evidence, "40 baseline + 15 for helping customers assess cost before enquiring. Publish verified pricing factors and avoid unsupported price claims.");
    add(`${service} checklist`, "business_brief", 45, evidence, "40 baseline + 5 for a useful educational resource that may support relevant, earned links. Validate audience questions before drafting and never buy links.");
  }
  return [...opportunities.values()].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
