// @vitest-environment node
import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import { db } from "@/lib/db";
import { registerAccount,requestVerification,confirmVerification,requestPasswordReset,resetPassword,requestEmailChange,confirmEmailChange,RESET_MESSAGE } from "@/services/identity/lifecycle";
import { openPayload } from "@/services/notifications/crypto";
import { createWebSession,validateWebSession } from "@/services/account/sessions";
import { privacyRequest } from "@/services/account";
import { processAccountExport,readAccountExport } from "@/services/account/data-export";
import { emitEvent } from "@/services/automation/events";
import { listPrivateNotifications,markPrivateNotification,setNotificationPreference } from "@/services/notification-access";
const testUrl=process.env.AUTOMATION_TEST_DATABASE_URL;
const enabled=testUrl==="postgresql://seo_test@127.0.0.1:55439/bizopt_seo_test";
const suffix=randomUUID(),email=`lifecycle-${suffix}@example.test`,password="Fixture-password-42";
let userId="",orgId="",foreignOrg="",foreignUser="";
let verification:{id:string;token:string};
async function proof(type:string) { const event=await db.outboxEvent.findFirstOrThrow({where:{userId,eventType:type},orderBy:{createdAt:"desc"}}); return openPayload<{id:string;token:string}>(event.secretPayloadEnc!,`event:${event.dedupeKey}`); }
describe.skipIf(!enabled)("account lifecycle PostgreSQL integration",()=>{
 beforeAll(async()=>{if(process.env.DATABASE_URL!==testUrl)throw new Error("Disposable DB required");vi.stubEnv("APP_URL","http://127.0.0.1:3105");vi.stubEnv("NOTIFICATION_PAYLOAD_KEY",Buffer.alloc(32,11).toString("base64"));});
 afterAll(async()=>{
  const ids=[userId,foreignUser].filter(Boolean);
  if(ids.length){await db.auditLog.deleteMany({where:{userId:{in:ids}}});await db.commercialConsent.deleteMany({where:{userId:{in:ids}}});}
  for(const id of [orgId,foreignOrg].filter(Boolean))await db.organization.delete({where:{id}});
  if(ids.length)await db.user.deleteMany({where:{id:{in:ids}}});
  vi.unstubAllEnvs();
 });
 it("commits one unverified account, inactive entitlement, hashed proof and encrypted intent",async()=>{
  await registerAccount({name:"Lifecycle fixture",email,password,orgName:`Lifecycle ${suffix}`,callbackUrl:"/billing?plan=team"});
  const user=await db.user.findUniqueOrThrow({where:{email},include:{memberships:{include:{org:{include:{entitlement:true}}}}}});userId=user.id;orgId=user.memberships[0].orgId;
  expect(user.emailVerified).toBeNull();expect(user.memberships[0].org.entitlement?.active).toBe(false);
  verification=await proof("identity.verification_requested");const row=await db.identityToken.findUniqueOrThrow({where:{id:verification.id}});expect(row.tokenHash).not.toContain(verification.token);expect(row.purpose).toBe("EMAIL_VERIFICATION");
  expect(await db.outboxEvent.count({where:{userId,eventType:"identity.verification_requested"}})).toBe(1);
 });
 it("a GET scanner cannot consume legacy or current verification proof",async()=>{
  const {GET}=await import("@/app/api/auth/verify-email/route");const before=await db.identityToken.findUniqueOrThrow({where:{id:verification.id}});
  const response=await GET(new Request(`http://127.0.0.1:3105/api/auth/verify-email?token=${verification.token}`));expect(response.status).toBe(303);expect(response.headers.get("location")).not.toContain(verification.token);
  expect((await db.identityToken.findUniqueOrThrow({where:{id:verification.id}})).consumedAt).toEqual(before.consumedAt);
 });
 it("resend invalidates old proof and two confirmation writers produce one welcome",async()=>{
  await requestVerification(email);const replacement=await proof("identity.verification_requested");
  await expect(confirmVerification(verification)).rejects.toThrow("invalid or expired");
  const results=await Promise.allSettled([confirmVerification(replacement),confirmVerification(replacement)]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  expect(await db.outboxEvent.count({where:{userId,eventType:"identity.verified"}})).toBe(1);
  expect((await db.entitlement.findUniqueOrThrow({where:{orgId}})).active).toBe(false);
 });
 it("expired and wrong-purpose recovery proofs cannot change a password",async()=>{
  await requestPasswordReset(email);const recovery=await proof("identity.password_reset_requested");
  await expect(confirmVerification(recovery)).rejects.toThrow("invalid or expired");
  await db.identityToken.update({where:{id:recovery.id},data:{expiresAt:new Date(Date.now()-1000)}});
  await expect(resetPassword({...recovery,password:"New-password-42",confirmPassword:"New-password-42"})).rejects.toThrow("invalid or expired");
  expect(await compare(password,(await db.user.findUniqueOrThrow({where:{id:userId}})).passwordHash!)).toBe(true);
 });
 it("real and absent accounts share reset response; reset consumes once and revokes every credential session",async()=>{
  expect((await requestPasswordReset(`absent-${suffix}@example.test`)).message).toBe(RESET_MESSAGE);expect((await requestPasswordReset(email)).message).toBe(RESET_MESSAGE);
  const recovery=await proof("identity.password_reset_requested");const browser=await createWebSession(userId);
  const mobile=await db.mobileSession.create({data:{userId,refreshHash:randomUUID(),expiresAt:new Date(Date.now()+60000)}});
  await db.supportAccessGrant.create({data:{userId,webSessionId:browser.id,tokenHash:randomUUID(),expiresAt:new Date(Date.now()+60000)}});
  const results=await Promise.allSettled([resetPassword({...recovery,password:"New-password-42",confirmPassword:"New-password-42"}),resetPassword({...recovery,password:"New-password-42",confirmPassword:"New-password-42"})]);
  expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);expect(await validateWebSession(userId,browser.id,browser.version)).toBe(false);
  expect((await db.mobileSession.findUniqueOrThrow({where:{id:mobile.id}})).revokedAt).not.toBeNull();expect(await db.supportAccessGrant.count({where:{userId,revokedAt:null}})).toBe(0);
  expect(await db.outboxEvent.count({where:{userId,eventType:"identity.password_changed"}})).toBe(1);
 });
 it("verifies a new email before replacing the old one and queues old-address security notice",async()=>{
  const newEmail=`changed-${suffix}@example.test`;await requestEmailChange(userId,{currentPassword:"New-password-42",email:newEmail});expect((await db.user.findUniqueOrThrow({where:{id:userId}})).email).toBe(email);
  const change=await proof("identity.email_change_requested");await confirmEmailChange(userId,change);expect((await db.user.findUniqueOrThrow({where:{id:userId}})).email).toBe(newEmail);
  expect((await db.outboxEvent.findFirstOrThrow({where:{userId,eventType:"identity.email_changed"}})).recipientEmail).toBe(email);
 });
 it("prepares an encrypted limited account archive with expiring identity-scoped access",async()=>{
  const request=await privacyRequest(orgId,userId,"export","New-password-42");await privacyRequest(orgId,userId,"export","New-password-42");expect(await db.dataExportJob.count({where:{orgId,userId}})).toBe(1);
  for(let index=0;index<5;index++){const job=await db.dataExportJob.findFirstOrThrow({where:{orgId,userId}});if(job.status==="ready")break;await processAccountExport();}
  const job=await db.dataExportJob.findFirstOrThrow({where:{orgId,userId}});expect(job.status).toBe("ready");expect(job.payloadEnc).not.toContain("changed-");
  const archive=await readAccountExport(orgId,userId,job.id);expect(archive.coverage).toMatchObject({credentialsIncluded:false,internalSupportNotesIncluded:false,workspaceOwnedContentIncluded:false});expect(JSON.stringify(archive)).not.toMatch(/passwordHash|tokenHash|totpSecret/);
  expect(await db.outboxEvent.count({where:{userId,eventType:"account.export_ready"}})).toBe(1);expect(request.ticketId).toBe(job.sourceTicketId);
  await db.dataExportJob.update({where:{id:job.id},data:{expiresAt:new Date(Date.now()-1000)}});await expect(readAccountExport(orgId,userId,job.id)).rejects.toThrow("unavailable");await processAccountExport();expect((await db.dataExportJob.findUniqueOrThrow({where:{id:job.id}})).payloadEnc).toBeNull();
 });
 it("enforces current identity/tenant selectors and database event associations",async()=>{
  const other=await db.user.create({data:{email:`other-${suffix}@example.test`,emailVerified:new Date()}});foreignUser=other.id;foreignOrg=(await db.organization.create({data:{name:"Other",slug:`other-life-${suffix}`,members:{create:{userId:foreignUser,role:"owner"}}}})).id;
  const event=await db.$transaction(tx=>emitEvent(tx,{orgId,userId,aggregateType:"User",aggregateId:userId,eventType:"identity.password_changed",dedupeKey:`fixture-notice:${suffix}`,payload:{}}));
  const notice=await db.notification.create({data:{orgId,userId,outboxEventId:event.id,type:event.eventType,category:"SECURITY",channel:"IN_APP",dedupeKey:`fixture-notice-channel:${suffix}`,correlationId:suffix,dataJson:{},status:"available"}});
  expect((await listPrivateNotifications(orgId,userId)).notifications.some(item=>item.id===notice.id)).toBe(true);expect((await listPrivateNotifications(foreignOrg,foreignUser)).notifications).toHaveLength(0);
  await expect(markPrivateNotification(foreignOrg,foreignUser,notice.id)).rejects.toThrow("not found");
  await expect(db.notification.create({data:{orgId:foreignOrg,userId:foreignUser,outboxEventId:event.id,type:event.eventType,category:"SECURITY",channel:"IN_APP",dedupeKey:`foreign-notice:${suffix}`,correlationId:suffix,dataJson:{}}})).rejects.toMatchObject({code:"P2003"});
 });
 it("blocks browser-role access to private automation tables",async()=>{
  await db.$executeRawUnsafe('GRANT SELECT ON "IdentityToken","OutboxEvent","Notification","DataExportJob" TO seo_browser_check');
  const rows=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET LOCAL ROLE seo_browser_check');return tx.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM "IdentityToken"');});expect(rows[0].count).toBe(0);
 });
 it("optional preference changes never disable required communications",async()=>{await setNotificationPreference(userId,{category:"OPERATIONAL",channel:"EMAIL",enabled:true,timezone:"Europe/London",digestFrequency:"weekly"});await expect(setNotificationPreference(userId,{category:"BILLING",channel:"EMAIL",enabled:false,timezone:"Europe/London",digestFrequency:"weekly"})).rejects.toThrow("required");});
});
