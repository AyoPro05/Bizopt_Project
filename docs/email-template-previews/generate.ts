import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EVENT_DEFINITIONS } from "../../services/notifications/policy";
import { renderEmail, escapeHtml } from "../../services/notifications/templates";

// Explicit reserved fixtures, independent of any application's actual mail configuration.
Object.assign(process.env, { APP_URL: "https://app.example.test", EMAIL_PROVIDER: "fake", EMAIL_FROM: "BizOpt preview <mail@example.test>", EMAIL_REPLY_TO: "reply@example.test", SUPPORT_URL: "https://app.example.test/help", NOTIFICATION_PAYLOAD_KEY: Buffer.alloc(32, 19).toString("base64") });

async function generate() {
  const directory = resolve(process.cwd(), "docs/email-template-previews");
  await mkdir(directory, { recursive: true });
  const rows: string[] = [];
  for (const [type, definition] of Object.entries(EVENT_DEFINITIONS)) {
    const rendered = renderEmail(type, { plan: "Base", amountMinor: type.startsWith("billing.introductory") ? 99 : 999, introductoryAmountMinor: 99, recurringAmountMinor: 999, currency: "usd", periodStart: "2026-10-15T12:00:00.000Z", periodEnd: "2026-10-22T12:00:00.000Z", nextBillingAt: "2026-10-22T12:00:00.000Z", occurredAt: "2026-10-15T12:00:00.000Z" }, { preview: true });
    await writeFile(resolve(directory, `${type}.html`), rendered.html + "\n");
    await writeFile(resolve(directory, `${type}.txt`), rendered.text + "\n");
    rows.push(`<tr><td>${escapeHtml(type)}</td><td>${definition.category}</td><td><a href="${type}.html">HTML</a> · <a href="${type}.txt">Plain text</a></td></tr>`);
  }
  await writeFile(resolve(directory, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BizOpt email previews</title><style>body{max-width:1000px;margin:40px auto;font:16px/1.5 system-ui;padding:16px;color:#172033}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}a{color:#284ec5}</style></head><body><h1>BizOpt email previews</h1><p>Reserved .test fixtures. No email is sent; proof and unsubscribe tokens are omitted. Template availability does not mean its domain engine is implemented.</p><table><thead><tr><th>Event</th><th>Category</th><th>Preview</th></tr></thead><tbody>${rows.join("")}</tbody></table></body></html>\n`);
  console.log(`Generated ${rows.length} token-free HTML/plain-text preview pairs.`);
}
generate().catch(() => { console.error("Preview generation unavailable."); process.exitCode = 1; });
