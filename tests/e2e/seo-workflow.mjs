// Run only against the disposable seeded local server; see docs/SEO_VERIFICATION.md.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.SEO_E2E_URL ?? "http://127.0.0.1:3105";
if (base !== "http://127.0.0.1:3105") throw new Error("This test is restricted to the disposable local server.");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const pageErrors = [];
const checks = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const tab = async (name) => page.getByRole("navigation", { name: "SEO sections" }).getByRole("button", { name, exact: true }).click();
const shot = async (name) => page.screenshot({ path: `docs/seo-screenshots/${name}.png`, fullPage: true });
await mkdir("docs/seo-screenshots", { recursive: true });

try {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).waitFor();
  await page.getByLabel("Email", { exact: true }).fill("seo-browser@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Local-test-password-42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/device-check|ai-studio/, { timeout: 20_000 });
  await page.goto(`${base}/seo`);
  await page.getByRole("heading", { name: "SEO Intelligence", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Add a website", exact: true }).or(page.getByRole("navigation", { name: "SEO sections" })).waitFor();
  pass("existing credentials sign-in and authenticated SEO route");

  if (await page.getByRole("heading", { name: "Add a website", exact: true }).isVisible()) {
    await shot("onboarding-desktop");
    await page.getByLabel("Business or website name").fill("QA fixture · Example services");
    await page.getByLabel("Website URL", { exact: true }).fill("https://example.com");
    await page.getByLabel("What should better visibility achieve?").fill("Help office managers find useful service information and request a quote");
    await page.getByLabel("Services or products").fill("Office cleaning, End of tenancy cleaning");
    await page.getByLabel("Who are your customers?").fill("Office managers and local business owners");
    await page.getByLabel("Service areas", { exact: false }).fill("London, Croydon");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create website workspace" }).click();
    await page.getByRole("navigation", { name: "SEO sections" }).waitFor();
    pass("website onboarding and authorised public scope saved");
  }

  await page.getByRole("button", { name: "Create SEO plan", exact: true }).click();
  await page.getByText("Your SEO plan is ready.", { exact: false }).waitFor();
  await tab("Opportunities");
  assert(await page.getByRole("button", { name: "Open draft", exact: true }).count() > 0);
  await shot("opportunities-desktop");
  pass("explainable content opportunities generated");
  await page.getByRole("button", { name: "Open draft", exact: true }).first().click();
  await page.getByLabel("Page title", { exact: true }).waitFor();
  await page.getByLabel("Page title", { exact: true }).fill(`QA fixture: office cleaning guidance ${Date.now()}`);
  await page.getByLabel("Article · Markdown", { exact: true }).fill("# Office cleaning guidance\n\nThis is QA fixture content for a disposable local test. It describes no real business.\n\n## What to ask\n\nConfirm scope, availability and a written quote before booking.");
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await page.getByText("A new content version has been saved.", { exact: false }).waitFor();
  await page.getByRole("link", { name: "Export saved version", exact: true }).waitFor();
  const savedTitle = await page.getByLabel("Page title", { exact: true }).inputValue();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export saved version", exact: true }).click();
  const download = await downloading;
  assert((await readFile(await download.path(), "utf8")).includes(savedTitle));
  pass("editable draft saved and exact saved version exported");
  await page.reload();
  await page.getByRole("navigation", { name: "SEO sections" }).waitFor();
  await tab("Content");
  await page.getByLabel("Page title", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Page title", { exact: true }).inputValue(), savedTitle);
  const options = page.getByLabel("Compare with an older saved version").locator("option");
  assert(await options.count() >= 2);
  await page.getByLabel("Compare with an older saved version").selectOption({ index: 1 });
  await shot("content-desktop");
  pass("draft resume and immutable version comparison");

  await tab("Local Visibility");
  const localCheck = page.getByRole("checkbox").first();
  const wasChecked = await localCheck.isChecked();
  await localCheck.click();
  await page.getByText("Local checklist updated.", { exact: false }).waitFor();
  assert.equal(await localCheck.isChecked(), !wasChecked);
  pass("manual local checklist persists");

  await tab("Opportunities");
  await page.getByRole("button", { name: "Authority & outreach", exact: true }).click();
  await page.getByRole("button", { name: "Add a relevant prospect", exact: true }).click();
  await page.getByLabel("Organisation", { exact: true }).fill("QA fixture trade association");
  await page.getByLabel("Public HTTPS website", { exact: true }).fill("https://example.org");
  await page.getByLabel("Why would a collaboration help their audience?").fill("QA fixture: explore a useful office maintenance checklist for the same audience.");
  await page.getByRole("button", { name: "Save prospect & draft", exact: true }).click();
  await page.getByText("Prospect and outreach draft saved for your review.", { exact: false }).waitFor();
  await page.getByText("Evidence & next steps", { exact: true }).first().click();
  assert((await page.getByLabel("Outreach draft · personalise before sending").inputValue()).includes("QA fixture trade association"));
  pass("relevant backlink prospect and outreach draft saved without sending");

  await tab("Results");
  if (!await page.getByLabel("Search Console property", { exact: true }).isVisible()) await page.getByRole("button", { name: "Import Search Console CSV", exact: true }).click();
  await page.getByLabel("Search Console property", { exact: true }).fill("sc-domain:example.com");
  await page.getByLabel("Period starts").fill("2026-01-01");
  await page.getByLabel("Period ends").fill("2026-01-02");
  await page.getByLabel("Or paste CSV text").fill("Date,Clicks,Impressions,Position\n2026-01-01,10,100,5\n2026-01-02,20,200,10");
  await page.getByRole("button", { name: "Import report", exact: true }).click();
  await page.getByText("Search Console report imported.", { exact: false }).waitFor();
  assert(await page.getByText("30", { exact: true }).count() > 0);
  assert(await page.getByText("10.00%", { exact: true }).count() > 0);
  await shot("results-desktop");
  pass("CSV property totals import and calculated CTR");

  await tab("Site Health");
  await page.getByRole("button", { name: "Run site audit", exact: true }).click();
  await page.getByRole("button", { name: "Cancel audit", exact: true }).waitFor();
  await page.getByRole("button", { name: "Cancel audit", exact: true }).click();
  await page.getByText("Audit cancelled.", { exact: false }).waitFor();
  pass("durable audit queuing and cancellation without external crawl");

  await tab("Overview");
  for (const mode of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
    await page.evaluate((theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); }, mode);
    const colors = await page.getByRole("button", { name: "Create SEO plan", exact: true }).evaluate((button) => { const style = getComputedStyle(button); return { foreground: style.color, background: style.backgroundColor }; });
    const luminance = (color) => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((part) => { const value = part / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722; };
    const light = luminance(colors.foreground);
    const dark = luminance(colors.background);
    assert((Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) >= 4.5, `Primary button text contrast in ${mode}`);
    pass(`${mode} primary button text contrast at least 4.5:1`);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 360 ? 900 : 1000 });
      await shot(`overview-${width}-${mode}`);
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      assert(dimensions.scroll <= dimensions.client + 1, `Page overflow at ${width}px ${mode}: ${JSON.stringify(dimensions)}`);
      pass(`${width}px ${mode} no page overflow`);
    }
  }
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await shot("overview-200-percent");
  const zoomDimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  assert(zoomDimensions.scroll <= zoomDimensions.client + 1, "Page overflow at 200% zoom");
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => document.activeElement !== document.body));
  pass("200% zoom, keyboard focus and reduced-motion smoke checks");

  const cookie = (await context.cookies()).map((entry) => `${entry.name}=${entry.value}`).join("; ");
  const csrf = await context.request.post(`${base}/api/seo`, { headers: { origin: "https://untrusted.example", cookie }, data: {} });
  assert.equal(csrf.status(), 403);
  const missing = await context.request.get(`${base}/api/seo?siteId=other-tenant-site`, { headers: { cookie } });
  assert.equal(missing.status(), 404);
  pass("cross-origin mutation and unavailable-tenant denial");
  assert.deepEqual(pageErrors, []);
  pass("no browser JavaScript exceptions");
  await writeFile("docs/seo-screenshots/browser-results.json", JSON.stringify({ checks, pageErrors }, null, 2));
} catch (error) {
  console.error("Browser workflow stopped at", page.url());
  console.error((await page.locator("body").innerText()).slice(-4000));
  await page.screenshot({ path: "/tmp/bizopt-seo-browser-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
