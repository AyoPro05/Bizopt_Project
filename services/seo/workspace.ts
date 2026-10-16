import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { planOpportunities } from "./planning";
import { createContentBrief, draftFromBrief, reviewContent, exportMarkdown } from "./content";
import { parseSearchConsoleCsv, aggregateMetrics } from "./metrics";
import { siteInput, versionInput } from "./schemas";
import { SeoError } from "./errors";

const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function requireSeoRole(orgId: string, userId: string, action: "manage" | "edit") {
  const membership = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) throw new SeoError("You do not have permission to use this workspace.", 403);
  if (action === "manage" && !["owner", "admin"].includes(membership.role)) throw new SeoError("Only a workspace owner or admin can manage websites.", 403);
}

export async function requireSeoSite(orgId: string, siteId: string) {
  const site = await db.seoSite.findFirst({ where: { id: siteId, orgId } });
  if (!site) throw new SeoError("Website not found.", 404);
  return site;
}

export async function createSeoSite(orgId: string, userId: string, input: unknown) {
  await requireSeoRole(orgId, userId, "manage");
  const { authorised: _authorised, ...data } = siteInput.parse(input);
  void _authorised;
  return db.$transaction(async (tx) => {
    if (await tx.seoSite.count({ where: { orgId } }) >= 10) throw new SeoError("This workspace supports up to 10 websites.");
    if (await tx.seoSite.findFirst({ where: { orgId, url: data.url } })) throw new SeoError("This website is already in your workspace.", 409);
    const site = await tx.seoSite.create({ data: { ...data, orgId, authorisedAt: new Date(), authorisedBy: userId } });
    await tx.auditLog.create({ data: { orgId, userId, action: "seo.public_scope_authorised", entity: "SeoSite", entityId: site.id, metadata: { url: site.url, scope: "public_html_only" } } });
    return site;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getSeoWorkspace(orgId: string, selectedId?: string) {
  const sites = await db.seoSite.findMany({ where: { orgId }, orderBy: { createdAt: "asc" }, take: 10 });
  const site = selectedId ? sites.find((s) => s.id === selectedId) : sites[0];
  if (selectedId && !site) throw new SeoError("Website not found.", 404);
  if (!site) return { sites, site: null, opportunities: [], content: [], audits: [], imports: [] };
  const [opportunities, content, audits, imports] = await Promise.all([
    db.seoOpportunity.findMany({ where: { orgId, siteId: site.id }, orderBy: { createdAt: "asc" }, take: 100 }),
    db.seoContent.findMany({ where: { orgId, siteId: site.id }, orderBy: { updatedAt: "desc" }, take: 30, include: { versions: { orderBy: { version: "desc" }, take: 1, select: { title: true, slug: true, description: true, version: true, source: true } } } }),
    db.seoAuditRun.findMany({ where: { orgId, siteId: site.id }, orderBy: { createdAt: "desc" }, take: 2 }),
    db.seoSearchImport.findMany({ where: { orgId, siteId: site.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, kind: true, startDate: true, endDate: true, property: true, searchType: true, completeness: true, totals: true, createdAt: true } }),
  ]);
  return { sites, site, opportunities, content, audits, imports };
}

export async function createSeoPlan(orgId: string, siteId: string) {
  const site = await requireSeoSite(orgId, siteId);
  const imported = await db.seoSearchImport.findFirst({ where: { orgId, siteId, kind: "queries", searchType: "web" }, orderBy: { createdAt: "desc" } });
  const rows = imported?.rows as Array<{ key: string; clicks: number; impressions: number; position: number | null }> | undefined;
  const queries = rows?.filter((r) => r.position !== null).map((r) => ({ query: r.key, clicks: r.clicks, impressions: r.impressions, position: r.position! }));
  const plan = planOpportunities(site, queries);
  await db.$transaction(plan.map((task) => db.seoOpportunity.upsert({
    where: { siteId_orgId_key: { siteId, orgId, key: task.key } },
    create: { orgId, siteId, key: task.key, payload: json({ ...task, evidenceAt: task.source === "search_console_import" ? imported?.createdAt : site.updatedAt, evidencePeriod: task.source === "search_console_import" && imported ? { startDate: imported.startDate, endDate: imported.endDate, searchType: "web" } : null }) },
    update: { payload: json({ ...task, evidenceAt: task.source === "search_console_import" ? imported?.createdAt : site.updatedAt, evidencePeriod: task.source === "search_console_import" && imported ? { startDate: imported.startDate, endDate: imported.endDate, searchType: "web" } : null }) },
  })));
  return plan.length;
}

export async function updateSeoOpportunity(orgId: string, siteId: string, id: string, data: { status: string; ownerId?: string | null; dueAt?: string | null }) {
  await requireSeoSite(orgId, siteId);
  if (data.ownerId && !await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: data.ownerId } } })) throw new SeoError("Assign tasks to a member of this workspace.");
  const result = await db.seoOpportunity.updateMany({ where: { id, orgId, siteId }, data: { status: data.status, ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}), ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}) } });
  if (!result.count) throw new SeoError("Opportunity not found.", 404);
}

export async function createSeoContent(orgId: string, userId: string, siteId: string, opportunityId: string) {
  const site = await requireSeoSite(orgId, siteId);
  const opportunity = await db.seoOpportunity.findFirst({ where: { id: opportunityId, orgId, siteId } });
  if (!opportunity) throw new SeoError("Opportunity not found.", 404);
  const existing = await db.seoContent.findFirst({ where: { orgId, siteId, opportunityId } });
  if (existing) return existing;
  const brief = createContentBrief(site, opportunity.payload as Parameters<typeof createContentBrief>[1]);
  const draft = draftFromBrief(site, brief);
  return db.$transaction(async (tx) => {
    const session = await tx.editorSession.create({ data: { orgId, userId, entityType: "seo_content", snapshotJson: json({ siteId, opportunityId, brief, ...draft }) } });
    const content = await tx.seoContent.create({ data: { orgId, siteId, opportunityId, sessionId: session.id, brief: json(brief) } });
    await tx.seoContentVersion.create({ data: { orgId, contentId: content.id, version: 1, title: draft.title, description: draft.description, slug: draft.slug, body: draft.body, source: draft.source, createdBy: userId } });
    await tx.seoOpportunity.updateMany({ where: { id: opportunityId, orgId, siteId }, data: { status: "in_progress" } });
    return content;
  });
}

export async function getSeoContent(orgId: string, siteId: string, id: string) {
  const content = await db.seoContent.findFirst({ where: { id, orgId, siteId }, include: { versions: { orderBy: { version: "desc" }, take: 20 } } });
  if (!content) throw new SeoError("Content not found.", 404);
  const current = content.versions[0];
  const keyword = (content.brief as { keyword?: string })?.keyword ?? "";
  return { ...content, reviewNotes: current ? reviewContent(current, keyword) : [] };
}

export async function saveSeoVersion(orgId: string, userId: string, contentId: string, input: unknown) {
  const { expectedVersion, ...fields } = versionInput.parse(input);
  return db.$transaction(async (tx) => {
    const content = await tx.seoContent.findFirst({ where: { id: contentId, orgId } });
    if (!content) throw new SeoError("Content not found.", 404);
    if (content.currentVersion !== expectedVersion) throw new SeoError("This draft changed in another session. Reload it before saving.", 409);
    const claimed = await tx.seoContent.updateMany({ where: { id: contentId, orgId, currentVersion: expectedVersion }, data: { currentVersion: { increment: 1 }, updatedAt: new Date() } });
    if (!claimed.count) throw new SeoError("This draft changed in another session. Reload it before saving.", 409);
    const version = await tx.seoContentVersion.create({ data: { ...fields, orgId, contentId, version: expectedVersion + 1, source: "edited", createdBy: userId } });
    await tx.editorSession.updateMany({ where: { id: content.sessionId, orgId }, data: { snapshotJson: json({ ...fields, contentId, version: expectedVersion + 1 }), lastSavedAt: new Date() } });
    return version;
  });
}

export async function exportSeoContent(orgId: string, siteId: string, contentId: string) {
  const content = await getSeoContent(orgId, siteId, contentId);
  const version = content.versions[0];
  if (!version) throw new SeoError("No saved content version found.", 404);
  return { filename: `${version.slug}.md`, markdown: exportMarkdown(version), version: version.version };
}

export async function queueSeoAudit(orgId: string, userId: string, siteId: string) {
  const site = await requireSeoSite(orgId, siteId);
  if (!site.authorisedAt) throw new SeoError("Explicit website authorisation is required before auditing.", 403);
  return db.$transaction(async (tx) => {
    const pending = await tx.seoAuditRun.findFirst({ where: { orgId, siteId, status: { in: ["queued", "running"] } } });
    if (pending) return pending;
    const used = await tx.seoAuditRun.count({ where: { orgId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (used >= 10) throw new SeoError("Daily audit limit reached. Try again tomorrow.", 429);
    return tx.seoAuditRun.create({ data: { orgId, siteId, requestedBy: userId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelSeoAudit(orgId: string, siteId: string, id: string) {
  const result = await db.seoAuditRun.updateMany({ where: { id, orgId, siteId, status: { in: ["queued", "running"] } }, data: { status: "cancelled", finishedAt: new Date(), lockedAt: null } });
  if (!result.count) throw new SeoError("This audit has already finished.", 409);
}

export async function importSeoSearch(orgId: string, userId: string, siteId: string, data: { csv: string; property: string; startDate: string; endDate: string; searchType: string }) {
  const site = await requireSeoSite(orgId, siteId);
  if (data.startDate > data.endDate || data.endDate > new Date().toISOString().slice(0, 10)) throw new SeoError("Choose a valid reporting period ending today or earlier.");
  const website = new URL(site.url);
  const property = data.property.trim();
  let matches = false;
  if (property.startsWith("sc-domain:")) {
    const domain = property.slice(10).toLowerCase();
    matches = !!domain && (website.hostname === domain || website.hostname.endsWith(`.${domain}`));
  } else {
    try {
      const prefix = new URL(property);
      matches = prefix.origin === website.origin && `${website.pathname.replace(/\/$/, "")}/`.startsWith(`${prefix.pathname.replace(/\/$/, "")}/`);
    } catch { /* invalid property remains unmatched */ }
  }
  if (!matches) throw new SeoError("The Search Console property must cover the selected website.");
  let imported: ReturnType<typeof parseSearchConsoleCsv>;
  try { imported = parseSearchConsoleCsv(data.csv); }
  catch (error) { throw new SeoError(error instanceof Error ? error.message : "Check the CSV export."); }
  if (!imported.rows.length) throw new SeoError("This CSV has no data rows. Export a report with data first.");
  if (imported.kind === "totals" && imported.rows.some((r) => r.key < data.startDate || r.key > data.endDate)) throw new SeoError("CSV dates must fall within the reporting period.");
  const days = Math.round((Date.parse(data.endDate) - Date.parse(data.startDate)) / 86_400_000) + 1;
  const completeness = imported.kind === "totals" && imported.rows.length === days ? "imported_complete_dates" : "partial";
  return db.seoSearchImport.create({ data: { orgId, siteId, kind: imported.kind, property, searchType: data.searchType, startDate: data.startDate, endDate: data.endDate, completeness, rows: json(imported.rows), totals: json(aggregateMetrics(imported.rows)), importedBy: userId } });
}

export const LOCAL_CHECKS = [
  { key: "profile", title: "Claim and verify your Business Profile", detail: "Use your real business name and an eligible location or service area." },
  { key: "contact", title: "Keep contact details consistent", detail: "Compare business name, address where applicable, phone and website across your site and trusted listings." },
  { key: "hours", title: "Confirm opening and holiday hours", detail: "Keep your real availability current so customers know when to contact you." },
  { key: "categories", title: "Choose accurate categories and services", detail: "Describe the services you actually provide; select the most relevant primary category." },
  { key: "service_areas", title: "Confirm the areas you actually serve", detail: "Avoid invented offices and duplicate location pages with no useful local information." },
  { key: "reviews", title: "Invite honest customer feedback", detail: "Ask customers consistently, without incentives or filtering out negative feedback." },
  { key: "landing_page", title: "Make your local landing page useful", detail: "Explain your real services, coverage, contact options and verified local evidence." },
] as const;

export async function saveLocalCheck(orgId: string, siteId: string, key: string, checked: boolean) {
  const site = await requireSeoSite(orgId, siteId);
  if (!site.serviceAreas.length) throw new SeoError("This website has no local service areas.");
  if (!LOCAL_CHECKS.some((c) => c.key === key)) throw new SeoError("Unknown checklist item.");
  const state = { ...(site.localChecklist as Record<string, boolean>), [key]: checked };
  await db.seoSite.updateMany({ where: { id: siteId, orgId, updatedAt: site.updatedAt }, data: { localChecklist: state } }).then((r) => {
    if (!r.count) throw new SeoError("The checklist changed. Reload and try again.", 409);
  });
}

export async function createOutreachDraft(orgId: string, userId: string, siteId: string, input: { organisation: string; url: string; relevance: string }) {
  const site = await requireSeoSite(orgId, siteId);
  const key = `outreach-${createHash("sha256").update(input.url).digest("hex").slice(0, 20)}`;
  const payload = { key, title: `Explore a partnership with ${input.organisation}`, keyword: input.organisation, intent: "commercial", source: "manual_prospect", evidence: input.relevance, reason: "User-provided prospect. Relevance and contact permission need human review; no backlink or authority data is available.", effort: "medium", priority: "medium", score: null, scoreVersion: "manual-v1", targetUrl: input.url, action: "outreach", volume: null, difficulty: null,
    outreachDraft: `Subject: A useful resource for ${input.organisation}\n\nHello ${input.organisation} team,\n\nI’m reaching out from ${site.name}. ${input.relevance}\n\nWe would like to explore whether a useful resource or collaboration could help your audience. Our website is ${site.url}.\n\n[Describe the specific resource and benefit. Verify the recipient and personalise this message before sending.]\n\nWould this be relevant to your team?\n\n[Your name]`, createdBy: userId };
  return db.seoOpportunity.upsert({ where: { siteId_orgId_key: { orgId, siteId, key } }, create: { orgId, siteId, key, payload: json(payload) }, update: { payload: json(payload) } });
}
