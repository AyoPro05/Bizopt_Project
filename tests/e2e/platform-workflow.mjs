// Local production-mode workflow only. No real mail, Stripe or customer data.
import assert from "node:assert/strict";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const url = "postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test";
if (process.env.DATABASE_URL !== url) throw new Error("Disposable local database required.");
const db = new PrismaClient({ datasourceUrl: url });
const base = "http://127.0.0.1:3105";
const password = "Local-test-password-42";
const secret = Buffer.alloc(20, 8);
const encryptionKey = Buffer.alloc(32, 7);
const invitationKey = "local-browser-invitation-key-with-32-characters";
const users = {};
for (const label of ["owner", "member", "staff"]) {
  const email = `platform-${label}@example.test`;
  users[label] = await db.user.upsert({ where: { email }, create: { email, name: `QA ${label}`, emailVerified: new Date(), passwordHash: await bcrypt.hash(password, 4) }, update: { name: `QA ${label}`, emailVerified: new Date(), passwordHash: await bcrypt.hash(password, 4) } });
}
await db.organization.deleteMany({ where: { slug: { in: ["platform-browser", "platform-browser-staff", "platform-browser-second"] } } });
const org = await db.organization.create({ data: { name: "QA shared workspace", slug: "platform-browser", members: { create: { userId: users.owner.id, role: "owner" } }, entitlement: { create: { active: true, userFacingState: "active", seatLimit: 2 } }, subscription: { create: { status: "active" } } } });
const staffOrg = await db.organization.create({ data: { name: "QA support operations", slug: "platform-browser-staff", members: { create: { userId: users.staff.id, role: "owner" } } } });
const secondOrg = await db.organization.create({ data: { name: "QA second workspace", slug: "platform-browser-second", members: { create: { userId: users.owner.id, role: "owner" } } } });
await db.user.update({ where: { id: users.owner.id }, data: { activeOrgId: org.id } });
await db.user.update({ where: { id: users.staff.id }, data: { activeOrgId: staffOrg.id } });
await db.userSettings.upsert({ where: { userId: users.owner.id }, create: { userId: users.owner.id, localDraftRecovery: false }, update: { localDraftRecovery: false } });
const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
cipher.setAAD(Buffer.from("bizopt-support-totp-v1"));
const enc = Buffer.concat([cipher.update(secret), cipher.final()]);
const totpSecretEnc = ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
await db.supportStaff.upsert({ where: { userId: users.staff.id }, create: { userId: users.staff.id, role: "support_admin", totpSecretEnc }, update: { active: true, role: "support_admin", totpSecretEnc, lastTotpCounter: null } });
function totp() { const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000))); const hash = createHmac("sha1", secret).update(counter).digest(); const offset = hash[19]&15; return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0"); }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const checks = [], errors = [];
const pass = name => { checks.push(name); console.log(`PASS ${name}`); };
const contexts = [];
async function newPage() { const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" }); contexts.push(context); const page = await context.newPage(); page.setDefaultTimeout(12000); page.on("pageerror", e => errors.push(e.message)); page.on("response", res => { if(res.status()>=400) console.log(`HTTP ${res.status()} ${new URL(res.url()).pathname}`); }); return page; }
async function login(page, email, callback = "/workspace") { await page.goto(`${base}/login?callbackUrl=${encodeURIComponent(callback)}`); await page.getByLabel("Email",{exact:true}).fill(email); await page.getByLabel("Password",{exact:true}).fill(password); await page.getByRole("button",{name:"Sign in",exact:true}).click(); await page.waitForURL(url => ["/device-check","/workspace","/billing"].includes(url.pathname),{timeout:20000}); }
async function request(page, path, data) { return page.evaluate(async ({path,data}) => { const res=await fetch(path,{method:data?"POST":"GET",headers:data?{"Content-Type":"application/json"}:undefined,body:data?JSON.stringify(data):undefined,cache:"no-store"}); return {status:res.status,body:await res.json()}; },{path,data}); }
await mkdir("docs/platform-screenshots",{recursive:true});
async function shot(page,name) { await page.screenshot({path:`docs/platform-screenshots/${name}.png`,fullPage:true}); }
try {
  const owner = await newPage();
  await login(owner, users.owner.email, "/billing?plan=team");
  await owner.getByRole("button",{name:"Continue to workspace",exact:true}).click();
  await owner.waitForURL(/billing\?plan=team/);
  await owner.getByRole("heading",{name:"Choose your plan before checkout",exact:true}).waitFor();
  assert(await owner.locator('input[name="plan"][value="team"]').isChecked());
  pass("plan selection survives credentials sign-in and device check");
  await owner.goto(`${base}/workspace`);
  await owner.getByRole("heading",{name:org.name,exact:true}).waitFor();
  const menu = owner.getByRole("button",{name:/Account menu for/});
  await menu.click(); await owner.getByRole("link",{name:"Account settings",exact:true}).waitFor();
  await owner.keyboard.press("Escape"); assert(await menu.evaluate(el=>el===document.activeElement));
  pass("account menu shows real identity and restores keyboard focus");
  await owner.getByLabel("Teammate email addresses").fill(users.member.email);
  await owner.getByRole("button",{name:"Review invitations",exact:true}).click();
  const preview = owner.getByRole("dialog",{name:"Review your invitations"}); await preview.waitFor();
  assert((await preview.innerText()).includes("No additional charge"));
  assert.equal(await db.workspaceInvite.count({where:{orgId:org.id}}),0);
  await shot(owner,"invitation-preview-desktop");
  await preview.getByRole("button",{name:"Confirm invitations",exact:true}).click();
  await owner.getByRole("status").filter({hasText:/invitation/i}).first().waitFor();
  const invite=await db.workspaceInvite.findFirstOrThrow({where:{orgId:org.id,status:"pending"}});
  assert.equal(invite.deliveryStatus,"queued");
  pass("explicit invitation preview and approval reserve one seat without sending real mail");
  const token=createHmac("sha256",invitationKey).update(`workspace-invite-v1:${invite.id}:${invite.generation}`).digest("hex");
  const member=await newPage();
  await member.goto(`${base}/invite#${new URLSearchParams({id:invite.id,token})}`);
  await member.getByRole("heading",{name:`Join ${org.name}.`,exact:true}).waitFor();
  assert(!member.url().includes("#"));
  await member.getByLabel("Email",{exact:true}).fill(users.member.email); await member.getByLabel("Password",{exact:true}).fill(password);
  await member.getByRole("button",{name:"Sign in",exact:true}).click(); await member.getByRole("button",{name:"Accept invitation",exact:true}).click();
  await member.getByRole("link",{name:"Open workspace",exact:true}).click();
  await member.getByRole("heading",{name:org.name,exact:true}).waitFor();
  assert((await member.locator("main").innerText()).includes("Your role is member"));
  assert.equal((await request(member,"/api/billing/plan",{action:"preview",targetPlan:"team"})).status,403);
  assert.equal((await request(member,"/api/workspace",{action:"preview_invites",emails:["blocked@example.test"],role:"member"})).status,403);
  pass("fragment invitation accepted once by verified teammate; member billing/admin access denied");
  assert.equal((await request(owner,"/api/devices/bind",{fingerprint:"owner-browser",label:"QA owner"})).status,200);
  assert.equal((await request(member,"/api/devices/bind",{fingerprint:"member-browser",label:"QA member"})).status,200);
  assert.equal((await request(member,"/api/devices/bind",{fingerprint:"member-second-browser"})).status,403);
  pass("two people independently bind a device; second device for same person is blocked");
  await member.goto(`${base}/support?report=1&workflow=%2Fseo`);
  await member.getByRole("heading",{name:"Report an issue",exact:true}).waitFor();
  await member.getByLabel("Subject",{exact:true}).fill("QA fixture: editor save issue");
  await member.getByLabel("What happened?",{exact:false}).fill("This is an isolated QA fixture report. The content editor save workflow needs a review.");
  await member.getByLabel("Include optional technical diagnostics").check();
  assert((await member.getByLabel("Diagnostics preview").innerText()).includes('"route": "/seo"'));
  await member.getByRole("button",{name:"Send report",exact:true}).click();
  await member.getByRole("status").filter({hasText:"Report received"}).waitFor();
  await shot(member,"customer-support-desktop");
  const ticket=await db.supportTicket.findFirstOrThrow({where:{orgId:org.id,userId:users.member.id}});
  assert.equal((await request(owner,`/api/support/${ticket.id}`)).status,404);
  pass("consented issue report persists; workspace owner cannot read another person's private ticket");
  const staff=await newPage(); await login(staff,users.staff.email); await staff.goto(`${base}/support-console`);
  await staff.getByLabel("Current password",{exact:true}).fill(password); await staff.getByLabel("Authenticator code",{exact:true}).fill(totp());
  await staff.getByRole("button",{name:"Unlock support console",exact:true}).click();
  await staff.getByRole("heading",{name:"Triage queue",exact:true}).waitFor();
  assert.equal(await staff.getByText("This is an isolated QA fixture report.",{exact:false}).count(),0);
  await staff.getByRole("button",{name:"Open private conversation",exact:true}).first().click();
  await staff.getByLabel("Internal note (optional)",{exact:true}).fill("QA INTERNAL SECRET must never reach the customer");
  await staff.getByRole("button",{name:"Save internal note and status",exact:true}).click();
  await staff.getByRole("status").filter({hasText:"Conversation update saved"}).waitFor();
  await staff.getByLabel("Message visibility",{exact:true}).selectOption("public");
  await staff.getByLabel("Reply to the customer",{exact:true}).fill("QA public reply: your report was reviewed.");
  await staff.getByLabel("Conversation status",{exact:true}).selectOption("triaged");
  await staff.getByRole("button",{name:"Send customer reply and status",exact:true}).click();
  await staff.getByText("QA public reply: your report was reviewed.",{exact:true}).waitFor();
  await staff.getByRole("button",{name:"Lock console",exact:true}).waitFor();
  await staff.waitForFunction(()=>!Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Lock console")?.disabled);
  await shot(staff,"staff-console-desktop");
  await member.getByRole("button",{name:"Refresh",exact:true}).click();
  await member.getByText("QA public reply: your report was reviewed.",{exact:true}).waitFor();
  assert(!(await member.locator("body").innerText()).includes("QA INTERNAL SECRET"));
  const detail=await request(member,`/api/support/${ticket.id}`); assert(!JSON.stringify(detail.body).includes("QA INTERNAL SECRET"));
  pass("password plus MFA unlocks separate staff console; internal note stays private and public reply reaches customer");
  await staff.getByRole("button",{name:"Lock console",exact:true}).click();
  await staff.getByRole("heading",{name:"Verify privileged access",exact:true}).waitFor();
  assert.equal((await request(staff,"/api/support/staff")).status,403);
  pass("locking privileged console revokes access immediately");
  await owner.goto(`${base}/settings`); await owner.getByRole("heading",{name:"A place for your preferences.",exact:true}).first().waitFor();
  await shot(owner,"account-settings-desktop");
  assert.equal((await request(owner,"/api/account",{action:"preferences",supportEmail:false,localDraftRecovery:true})).status,200);
  assert.equal((await request(owner,"/api/account")).body.preferences.localDraftRecovery,true);
  assert.equal((await request(owner,"/api/account",{action:"preferences",supportEmail:false,localDraftRecovery:false})).status,200);
  pass("local recovery preference is explicit, persisted and reversible");
  for (const mode of ["light","dark"]) {
    await owner.emulateMedia({colorScheme:mode,reducedMotion:"reduce"});
    await owner.evaluate(mode=>{localStorage.setItem("theme",mode);document.documentElement.classList.toggle("dark",mode==="dark");},mode);
    for (const width of [320,768,1440]) {
      await owner.setViewportSize({width,height:1000}); await owner.goto(`${base}/workspace`); await owner.getByRole("heading",{name:org.name,exact:true}).waitFor();
      await owner.evaluate(mode=>document.documentElement.classList.toggle("dark",mode==="dark"),mode);
      assert(await owner.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${mode} ${width} horizontal overflow`);
      await shot(owner,`workspace-${mode}-${width}`);
      if(width===320) { const open=owner.getByRole("button",{name:"Open menu",exact:true}); await open.click(); await owner.getByRole("navigation",{name:"Mobile navigation",exact:true}).waitFor(); await owner.keyboard.press("Escape"); assert(await open.evaluate(el=>el===document.activeElement)); }
    }
  }
  pass("workspace reflows at 320, 768 and 1440px in both themes; mobile navigation contains and restores focus");
  // 1280px browser at 400% zoom has the same 320 CSS-pixel reflow viewport.
  await owner.setViewportSize({width:320,height:800});
  for(const path of ["/settings","/help","/support","/billing"]) { await owner.goto(`${base}${path}`); await owner.locator("main").waitFor(); assert(await owner.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${path} 320px overflow`); }
  pass("settings, help, support and billing fit a 320 CSS-pixel viewport (400% reflow equivalent)");
  await owner.setViewportSize({width:1440,height:1000}); await owner.goto(`${base}/workspace`);
  await owner.getByRole("button",{name:/Account menu for/}).click(); await owner.getByRole("button",{name:"QA second workspace",exact:true}).click();
  await owner.waitForURL(/home/); assert.equal((await request(owner,"/api/account")).body.workspace.id,secondOrg.id);
  assert.equal((await request(owner,"/api/account",{action:"switch_workspace",orgId:org.id})).status,200);
  pass("workspace switch reloads the shell and uses the authorised active workspace");
  const session=(await request(member,"/api/account")).body.currentSessionId;
  assert(session); assert.equal((await request(member,"/api/account",{action:"sign_out_all",password})).status,200);
  assert.equal((await request(member,"/api/account")).status,401);
  pass("password-confirmed sign out everywhere invalidates the active cookie immediately");
  assert.deepEqual(errors,[]); pass("no browser runtime exceptions in the tested flows");
  await writeFile("docs/platform-screenshots/results.json",JSON.stringify({browser:await browser.version(),checks,errors},null,2));
} catch (error) { for (let i=0;i<contexts.length;i++) { const page=contexts[i].pages()[0]; if(page) { await shot(page,`failed-${i}`); console.log(`PAGE ${i}: ${(await page.locator("body").innerText()).slice(-1600)}`); } } throw error; } finally { for(const context of contexts)await context.close();await browser.close();await db.$disconnect(); }
