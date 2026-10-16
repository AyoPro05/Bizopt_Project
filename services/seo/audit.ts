// Next.js bundles this server-side HTML parser; no browser execution or new dependency is required.
// @ts-expect-error The bundled parser does not ship a declaration file.
import { parse as parseHtml } from "next/dist/compiled/node-html-parser";
import { AUDIT_USER_AGENT, safeFetch, validateAuditUrl, withinScope } from "./safe-fetch";

export type AuditFinding = {
  code: string;
  severity: "high" | "medium" | "low";
  url: string;
  evidence: string;
  explanation: string;
  fix: string;
};

export type AuditPage = {
  url: string;
  status: number;
  title: string | null;
  description: string | null;
  h1Count: number;
  canonical: string | null;
  indexable: boolean;
  images: number;
  missingAlt: number;
  links: string[];
};

export type AuditResult = { pages: AuditPage[]; findings: AuditFinding[]; coverage: string[]; limited: boolean };

type HtmlNode = {
  textContent: string;
  getAttribute(name: string): string | undefined;
  hasAttribute(name: string): boolean;
  querySelector(selector: string): HtmlNode | null;
  querySelectorAll(selector: string): HtmlNode[];
};
const parse = parseHtml as (html: string) => HtmlNode;
const cleanText = (value?: string | null) => value?.replace(/\s+/g, " ").trim() || null;

function resolveLink(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export function parsePage(html: string, url: string, status: number): AuditPage {
  const root = parse(html);
  const meta = root.querySelectorAll("meta");
  const description = meta.find((node) => node.getAttribute("name")?.toLowerCase() === "description");
  const robots = meta.filter((node) => ["robots", "googlebot"].includes(node.getAttribute("name")?.toLowerCase() ?? ""));
  const canonical = root.querySelectorAll("link").find((node) => node.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("canonical"));
  const images = root.querySelectorAll("img");
  const base = resolveLink(root.querySelector("base")?.getAttribute("href"), url) ?? url;
  return {
    url, status,
    title: cleanText(root.querySelector("title")?.textContent),
    description: cleanText(description?.getAttribute("content")),
    h1Count: root.querySelectorAll("h1").length,
    canonical: resolveLink(canonical?.getAttribute("href"), base),
    indexable: status >= 200 && status < 300 && !robots.some((node) => /(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(node.getAttribute("content") ?? "")),
    images: images.length,
    missingAlt: images.filter((node) => !node.hasAttribute("alt")).length,
    links: [...new Set(root.querySelectorAll("a").map((node) => resolveLink(node.getAttribute("href"), base)).filter((link): link is string => Boolean(link)))].slice(0, 500),
  };
}

type RobotRule = { allow: boolean; path: string };
type RobotPolicy = { rules: RobotRule[]; sitemaps: string[]; delay: number };

function parseRobots(body: string): RobotPolicy {
  const groups: { agents: string[]; rules: RobotRule[]; delay: number }[] = [];
  const sitemaps: string[] = [];
  let group: (typeof groups)[number] | undefined;
  let directives = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "sitemap" && value) { sitemaps.push(value); continue; }
    if (key === "user-agent") {
      if (!group || directives) { group = { agents: [], rules: [], delay: 0 }; groups.push(group); directives = false; }
      group.agents.push(value.toLowerCase());
    } else if (group) {
      if (key === "allow" || key === "disallow") {
        directives = true;
        if (value.length > 2_048 || group.rules.length >= 1_000) throw new Error("Robots policy exceeds the safe parser budget.");
        if (value) group.rules.push({ allow: key === "allow", path: value });
      } else if (key === "crawl-delay") {
        directives = true;
        if (Number.isFinite(Number(value)) && Number(value) >= 0) group.delay = Number(value) * 1_000;
      }
    }
  }
  const product = AUDIT_USER_AGENT.split("/")[0].toLowerCase();
  const specificity = (agents: string[]) => Math.max(-1, ...agents.map((agent) => agent === "*" ? 0 : agent && product.includes(agent) ? agent.length : -1));
  const best = Math.max(-1, ...groups.map((entry) => specificity(entry.agents)));
  const selected = groups.filter((entry) => best >= 0 && specificity(entry.agents) === best);
  return { rules: selected.flatMap((entry) => entry.rules), sitemaps: sitemaps.slice(0, 2), delay: Math.max(0, ...selected.map((entry) => entry.delay)) };
}

function robotsAllows(url: URL, policy: RobotPolicy): boolean {
  const normalise = (value: string) => Array.from(value.replace(/%[0-9a-f]{2}/gi, (encoded) => {
    const character = String.fromCharCode(parseInt(encoded.slice(1), 16));
    return /[a-z0-9._~-]/i.test(character) ? character : encoded.toUpperCase();
  })).map((character) => character.charCodeAt(0) > 127 ? encodeURIComponent(character) : character).join("");
  const target = normalise(url.pathname + url.search);
  const matches = policy.rules.filter(({ path }) => {
    const anchored = path.endsWith("$");
    const pattern = normalise(anchored ? path.slice(0, -1) : path) + (anchored ? "" : "*");
    // Greedy wildcard matching avoids regex backtracking on untrusted robots rules.
    let cursor = 0;
    let position = 0;
    let star = -1;
    let retry = 0;
    while (position < target.length) {
      if (pattern[cursor] === "*") { star = cursor++; retry = position; }
      else if (pattern[cursor] === target[position]) { cursor++; position++; }
      else if (star >= 0) { cursor = star + 1; position = ++retry; }
      else return false;
    }
    while (pattern[cursor] === "*") cursor++;
    return cursor === pattern.length;
  });
  const longest = Math.max(-1, ...matches.map(({ path }) => path.replace(/[\*$]/g, "").length));
  return longest < 0 || matches.some(({ path, allow }) => allow && path.replace(/[\*$]/g, "").length === longest);
}

/** A server-rendered HTML sample. Ownership/tenant permission is enforced by the caller. */
export async function auditSite(input: string): Promise<AuditResult> {
  const scope = validateAuditUrl(input);
  const deadline = Date.now() + 40_000;
  const result: AuditResult = {
    pages: [], findings: [], limited: false,
    coverage: ["Observed server HTML only; JavaScript is not executed.", "Maximum 12 pages, depth 2, 3 sitemap documents, 200 findings, 1 MiB per response and 40 seconds; same origin and submitted path only.", "Checks cover HTTP status, metadata, headings, canonical tags, indexability, image alt attributes, JSON-LD syntax and sampled internal links.", "This sample does not measure rankings, backlinks, Core Web Vitals or structured-data eligibility."],
  };
  const finding = (code: string, severity: AuditFinding["severity"], url: string, evidence: string, explanation: string, fix: string) => {
    if (result.findings.length >= 200) { result.limited = true; return; }
    result.findings.push({ code, severity, url, evidence: evidence.slice(0, 500), explanation, fix });
  };
  let robots: RobotPolicy;
  try {
    const response = await safeFetch(new URL("/robots.txt", scope).href, { deadline, scope: new URL(scope.origin) });
    if (response.status !== 404 && (response.status < 200 || response.status >= 300)) throw new Error("Robots policy could not be determined.");
    // An HTML login/error page is not a reliable robots policy.
    if (response.status !== 404 && /^\s*(?:<!doctype\s+html|<html)/i.test(response.body)) throw new Error("Robots returned HTML.");
    robots = parseRobots(response.status === 404 ? "" : response.body);
    result.coverage.push(response.status === 404 ? "robots.txt returned 404; no crawl exclusions were published." : "Crawl follows robots.txt rules for BizOptzSEO and wildcard agents.");
  } catch {
    result.limited = true;
    finding("ROBOTS_UNAVAILABLE", "high", scope.href, "robots.txt could not be read reliably.", "Crawling stopped because crawl permission is unknown.", "Make robots.txt publicly available or return a genuine 404, then retry.");
    return result;
  }

  const queue: { url: string; depth: number }[] = [{ url: scope.href, depth: 0 }];
  const queued = new Set([scope.href]);
  const canRequest = (url: URL) => withinScope(url, scope) && robotsAllows(url, robots);
  const enqueue = (url: string, depth: number) => {
    if (queued.size >= 500) { result.limited = true; return; }
    try {
      const target = validateAuditUrl(url);
      if (!canRequest(target) || queued.has(target.href) || /\.(?:pdf|png|jpe?g|gif|svg|webp|mp4|zip|css|js|ico|xml)$/i.test(target.pathname)) return;
      queued.add(target.href); queue.push({ url: target.href, depth });
    } catch { /* Invalid, non-HTTPS and out-of-scope links are never fetched. */ }
  };
  let lastRequest = Date.now();
  const respectDelay = async () => {
    const delay = Math.max(0, lastRequest + robots.delay - Date.now());
    if (Date.now() + delay >= deadline) throw new Error("Crawl-delay exceeds the remaining audit budget.");
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastRequest = Date.now();
  };
  const sitemapQueue = robots.sitemaps.length ? [...robots.sitemaps] : [new URL("/sitemap.xml", scope).href];
  const visitedSitemaps = new Set<string>();
  while (sitemapQueue.length && visitedSitemaps.size < 3) {
    const sitemap = sitemapQueue.shift()!;
    try {
      const target = validateAuditUrl(new URL(sitemap, scope).href);
      if (target.origin !== scope.origin || !robotsAllows(target, robots) || visitedSitemaps.has(target.href)) continue;
      visitedSitemaps.add(target.href);
      await respectDelay();
      const response = await safeFetch(target.href, { deadline, scope: new URL(scope.origin), canRequest: (url) => robotsAllows(url, robots) });
      if (response.status >= 200 && response.status < 300) {
        const xml = parse(response.body);
        for (const node of xml.querySelectorAll("url loc").slice(0, 100)) {
          const link = resolveLink(node.textContent.trim(), target.href);
          if (link) enqueue(link, 1);
        }
        for (const node of xml.querySelectorAll("sitemap loc").slice(0, 3)) {
          const link = resolveLink(node.textContent.trim(), target.href);
          if (link) sitemapQueue.push(link);
        }
      }
    } catch { result.coverage.push("Sitemap discovery was unavailable or limited; internal links were used."); }
  }
  if (sitemapQueue.length) result.limited = true;

  let attempted = 0;
  const visited = new Set<string>();
  while (queue.length && attempted < 12 && Date.now() < deadline) {
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);
    if (!canRequest(new URL(item.url))) {
      result.limited = true;
      finding("ROBOTS_BLOCKED", "medium", item.url, "robots.txt disallows this path.", "This page was excluded from the sample.", "Review the robots rule if search engines should crawl this page.");
      continue;
    }
    attempted++;
    try {
      await respectDelay();
      const response = await safeFetch(item.url, { deadline, scope, canRequest });
      if (visited.has(response.url) && response.url !== item.url) continue;
      visited.add(response.url);
      const contentType = response.headers["content-type"] ?? "";
      const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType) || (!contentType && /^\s*(?:<!doctype\s+html|<html|<head|<title)/i.test(response.body));
      const page = parsePage(isHtml ? response.body : "", response.url, response.status);
      if (/(?:^|[\s,:])(noindex|none)(?:$|[\s,])/i.test(response.headers["x-robots-tag"] ?? "")) page.indexable = false;
      result.pages.push(page);
      if (page.status >= 400) finding("HTTP_ERROR", "high", page.url, `HTTP ${page.status}`, "This sampled URL returns an error response.", "Restore the page or redirect it to a relevant working page.");
      if (!isHtml || page.status >= 400) continue;
      if (!page.title) finding("MISSING_TITLE", "high", page.url, "No non-empty title element was found.", "Search results lack an explicit page title.", "Add a unique descriptive title that reflects the service and location when relevant.");
      if (!page.description) finding("MISSING_DESCRIPTION", "medium", page.url, "No non-empty meta description was found.", "This page lacks a controlled summary for search engines.", "Write a useful unique meta description describing the page and a clear benefit.");
      if (page.h1Count !== 1) finding("H1_COUNT", "medium", page.url, `${page.h1Count} H1 headings found.`, "The main page heading is missing or ambiguous.", "Use one clear H1 describing the page's main topic.");
      if (!page.canonical) finding("MISSING_CANONICAL", "low", page.url, "No valid canonical link was found.", "The preferred URL is not declared in the observed HTML.", "Add an absolute canonical URL for the preferred version of this page.");
      else if (page.canonical !== page.url) finding("CANONICAL_OTHER_URL", "low", page.url, `Canonical points to ${page.canonical}.`, "This page declares another URL as its preferred version; this may be intentional for duplicate content.", "Confirm the canonical points to the page you want indexed, using a self-referencing canonical for unique pages.");
      if (!page.indexable) finding("NOINDEX", "high", page.url, "A noindex/none directive was observed in HTML or response headers.", "Search engines are instructed to omit this page from their index.", "Remove noindex only if this page should appear in search results.");
      if (page.missingAlt) finding("MISSING_IMAGE_ALT", "medium", page.url, `${page.missingAlt} of ${page.images} images omit the alt attribute.`, "Images without alt attributes lose accessible text alternatives.", "Describe meaningful images with alt text; use alt=\"\" for decorative images.");
      for (const script of parse(response.body).querySelectorAll("script")) {
        if (script.getAttribute("type")?.trim().toLowerCase() !== "application/ld+json") continue;
        try { JSON.parse(script.textContent); }
        catch { finding("INVALID_STRUCTURED_DATA", "medium", page.url, "A JSON-LD script contains invalid JSON.", "Search engines cannot parse this structured-data block.", "Correct the JSON syntax and validate the markup against the relevant schema."); }
      }
      if (item.depth < 2) for (const link of page.links) enqueue(link, item.depth + 1);
      else if (page.links.some((link) => { try { return canRequest(new URL(link)) && !visited.has(link); } catch { return false; } })) result.limited = true;
    } catch {
      result.limited = true;
      finding("PAGE_UNAVAILABLE", "medium", item.url, "The page could not be fetched within the audit's network and time limits.", "This URL could not be evaluated; no SEO condition has been inferred.", "Check HTTPS availability, redirects and robots policy, then retry.");
    }
  }
  if (queue.length) result.limited = true;
  for (const [field, code] of [["title", "DUPLICATE_TITLE"], ["description", "DUPLICATE_DESCRIPTION"]] as const) {
    const groups = new Map<string, AuditPage[]>();
    for (const page of result.pages) {
      const value = page[field]?.toLowerCase();
      if (value) groups.set(value, [...(groups.get(value) ?? []), page]);
    }
    for (const pages of groups.values()) if (pages.length > 1) for (const page of pages) {
      finding(code, "medium", page.url, `Same ${field} observed on ${pages.length} sampled URLs.`, "These sampled pages share metadata and may be hard to distinguish in search.", `Write a unique ${field} matching this page's purpose.`);
    }
  }
  const broken = new Map(result.pages.filter((page) => page.status >= 400).map((page) => [page.url, page.status]));
  for (const page of result.pages) for (const link of page.links) if (broken.has(link)) {
    finding("BROKEN_INTERNAL_LINK", "high", page.url, `${link} returned HTTP ${broken.get(link)}.`, "An internal link points to an observed error response.", "Update this link to a working relevant page or restore the destination.");
  }
  result.coverage.push(`${result.pages.length} pages observed. Unvisited links and JavaScript-generated content remain unverified.`);
  return result;
}
