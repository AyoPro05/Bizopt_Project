import { z } from "zod";

export const statuses = ["received", "triaged", "investigating", "waiting_for_user", "resolved", "closed"] as const;
export const ticketInput = z.object({
  requestId: z.string().uuid(),
  category: z.enum(["technical", "billing", "account", "seo", "feedback", "privacy", "security"]),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(10000),
  severity: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  workflow: z.string().trim().min(1).max(100),
  reproducibility: z.string().trim().max(1000).optional(),
  diagnosticsConsent: z.boolean().default(false),
  diagnostics: z.unknown().optional(),
  notifyByEmail: z.boolean().default(false),
}).strict();
export const replyInput = z.object({ expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(10000), reopen: z.boolean().default(false) }).strict();
export const staffUpdateInput = z.object({ expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(10000).optional(), internal: z.boolean().default(false), status: z.enum(statuses).optional(), assigneeId: z.string().max(100).nullable().optional() }).strict().refine((value) => value.body || value.status || value.assigneeId !== undefined, "Choose an action.");

const diagnosticSchema = z.object({
  appVersion: z.string().regex(/^[\w.\-]{1,40}$/).optional(),
  browser: z.enum(["Chromium", "Firefox", "Safari", "Other"]).optional(),
  browserVersion: z.string().regex(/^[\d.]{1,30}$/).optional(),
  os: z.enum(["iOS", "Android", "macOS", "Windows", "Linux", "Other"]).optional(),
  errorId: z.string().regex(/^[a-zA-Z0-9_\-]{1,80}$/).optional(),
});

/** Excluded values are discarded server-side even if a client submits them. */
export function sanitiseDiagnostics(value: unknown, consent: boolean): Record<string, string> | null {
  if (!consent) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of Object.keys(diagnosticSchema.shape) as (keyof typeof diagnosticSchema.shape)[]) {
    const parsed = diagnosticSchema.shape[key].safeParse(source[key]);
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
  }
  if (typeof source.route === "string") {
    const route = source.route.split(/[?#]/, 1)[0];
    // Only known static workflow routes: URL path segments can themselves contain tokens.
    if (/^\/(?:dashboard|home|seo|help|support|settings|workspace|billing|devices|integrations|ai-studio|campaigns|calendar|assets|analytics|growth-intelligence|compliance-center)?\/?$/.test(route)) result.route = route;
  }
  return result;
}
