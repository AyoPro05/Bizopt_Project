import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/platform-permissions";
import { AppError } from "@/services/platform/errors";
import { sealPayload, openPayload } from "@/services/notifications/crypto";
import { emitEvent } from "@/services/automation/events";

async function verifiedMember(orgId: string, userId: string) {
  await requireCapability(orgId, userId, "workspace.read");
  const user = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  if (!user?.emailVerified) throw new AppError("Verify your email before requesting or downloading account data.", 403);
}
export async function readAccountExport(orgId: string, userId: string, id: string) {
  await verifiedMember(orgId,userId);
  const job = await db.dataExportJob.findFirst({ where: { id, orgId, userId, status: "ready", expiresAt: { gt: new Date() } }, select: { id: true, payloadEnc: true } });
  if (!job?.payloadEnc) throw new AppError("This export is unavailable or has expired.", 404);
  await db.auditLog.create({ data: { orgId,userId,action:"account.export_downloaded",entity:"DataExportJob",entityId:id } });
  return openPayload<Record<string, unknown>>(job.payloadEnc, `account-export:${job.id}`);
}
export async function listAccountExports(orgId: string, userId: string) {
  await verifiedMember(orgId,userId);
  return db.dataExportJob.findMany({ where: { orgId,userId }, orderBy:{createdAt:"desc"}, take:20, select:{id:true,status:true,createdAt:true,expiresAt:true,completedAt:true,failureCode:true} });
}
export async function processAccountExport() {
  const now = new Date();
  await db.dataExportJob.updateMany({ where:{expiresAt:{lte:now},payloadEnc:{not:null}}, data:{payloadEnc:null,status:"expired"} });
  await db.dataExportJob.updateMany({ where: { status: "processing", attemptCount: { gte: 3 }, leaseUntil: { lt: now } }, data: { status: "failed", leaseToken: null, leaseUntil: null, payloadEnc: null, failureCode: "LEASE_EXHAUSTED" } });
  const due = { attemptCount:{lt:3}, OR:[{status:"pending",availableAt:{lte:now}},{status:"processing",leaseUntil:{lt:now}}] };
  const job=await db.dataExportJob.findFirst({where:due,orderBy:{createdAt:"asc"}});
  if(!job)return false;
  const leaseToken=randomUUID();
  const claim=await db.dataExportJob.updateMany({where:{id:job.id,...due},data:{status:"processing",attemptCount:{increment:1},leaseToken,leaseUntil:new Date(Date.now()+90_000)}});
  if(!claim.count)return false;
  try {
    await db.$transaction(async tx => {
      const membership=await tx.orgMember.findUnique({where:{orgId_userId:{orgId:job.orgId,userId:job.userId}},select:{role:true}});
      const user=await tx.user.findUnique({where:{id:job.userId},select:{id:true,name:true,email:true,emailVerified:true,createdAt:true,settings:{select:{theme:true,supportEmail:true,localDraftRecovery:true}}}});
      if(!membership || !user?.emailVerified)throw new Error("IDENTITY_CHANGED");
      const [tickets,preferences,sessions,audit] = await Promise.all([
        tx.supportTicket.findMany({where:{orgId:job.orgId,userId:job.userId},take:501,orderBy:{createdAt:"desc"},select:{id:true,subject:true,description:true,category:true,status:true,createdAt:true,messages:{where:{internal:false},select:{body:true,createdAt:true},orderBy:{createdAt:"asc"}}}}),
        tx.notificationPreference.findMany({where:{userId:job.userId},select:{channel:true,category:true,enabled:true,timezone:true,digestFrequency:true}}),
        tx.webSession.findMany({where:{userId:job.userId},take:501,orderBy:{createdAt:"desc"},select:{label:true,createdAt:true,lastUsedAt:true,expiresAt:true,revokedAt:true}}),
        tx.auditLog.findMany({where:{userId:job.userId,OR:[{orgId:job.orgId},{orgId:null}]},take:501,orderBy:{createdAt:"desc"},select:{action:true,createdAt:true}}),
      ]);
      const exportData={formatVersion:1,scope:"account-in-current-workspace",generatedAt:now.toISOString(),user,membership:{workspaceId:job.orgId,role:membership.role},preferences,tickets:tickets.slice(0,500),sessions:sessions.slice(0,500),activity:audit.slice(0,500),coverage:{maxRecordsPerCollection:500,truncated:tickets.length>500||sessions.length>500||audit.length>500,workspaceOwnedContentIncluded:false,internalSupportNotesIncluded:false,credentialsIncluded:false}};
      const bytes=JSON.stringify(exportData);
      if(Buffer.byteLength(bytes)>2_000_000)throw new Error("EXPORT_SCOPE_REVIEW_REQUIRED");
      const expiresAt=new Date(Date.now()+24*3600_000);
      const finished=await tx.dataExportJob.updateMany({where:{id:job.id,status:"processing",leaseToken},data:{status:"ready",payloadEnc:sealPayload(JSON.parse(bytes),`account-export:${job.id}`),expiresAt,completedAt:new Date(),leaseToken:null,leaseUntil:null,failureCode:null}});
      if(!finished.count)throw new Error("LEASE_LOST");
      await emitEvent(tx,{orgId:job.orgId,userId:job.userId,eventType:"account.export_ready",aggregateType:"account_export",aggregateId:job.id,dedupeKey:`account-export-ready:${job.id}`,payload:{expiresAt:expiresAt.toISOString()}});
    },{isolationLevel:"Serializable"});
  } catch {
    await db.dataExportJob.updateMany({where:{id:job.id,leaseToken},data:{status:job.attemptCount+1>=3?"failed":"pending",failureCode:"EXPORT_REVIEW_REQUIRED",leaseToken:null,leaseUntil:null,availableAt:new Date(Date.now()+30_000*2**job.attemptCount)}});
  }
  return true;
}
