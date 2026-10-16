import { randomBytes } from "node:crypto";
import { type Prisma, type User } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { identityTransaction, lockIdentity } from "./database";
import { identityConfig } from "./config";
export { identityConfig } from "./config";
import { safeInternalDestination } from "@/lib/redirect-url";
import { slugify } from "@/lib/helpers";
import { AppError } from "@/services/platform/errors";
import { emitEvent } from "@/services/automation/events";
import { trustedAppUrl } from "@/services/notifications/config";
import { changeEmailInput, changePasswordInput, emailInput, proofInput, registrationInput, resetInput } from "./schemas";
import { createIdentitySecret, hashIdentityToken, validIdentityProof, type IdentityProof, type IdentityPurpose } from "./tokens";

export const RESET_MESSAGE = "If an eligible account exists, we’ll send password reset instructions.";
export const VERIFICATION_MESSAGE = "If an eligible account exists, we’ll queue a verification email. Please check your inbox and spam folder.";
const invalidProof = () => new AppError("This link is invalid or expired. Request a new link.", 400);

async function issue(tx: Prisma.TransactionClient, user: Pick<User,"id"|"email">, purpose: IdentityPurpose, targetEmail: string, minutes: number, callbackUrl?: string) {
  const now = new Date();
  await tx.identityToken.updateMany({ where: {userId:user.id,purpose,consumedAt:null}, data:{consumedAt:now} });
  const {token,tokenHash} = createIdentitySecret(); const expiresAt = new Date(+now + minutes*60000);
  const record = await tx.identityToken.create({data:{userId:user.id,purpose,tokenHash,targetEmail,expiresAt}});
  const eventType = purpose === "EMAIL_VERIFICATION" ? "identity.verification_requested" : purpose === "PASSWORD_RESET" ? "identity.password_reset_requested" : "identity.email_change_requested";
  await emitEvent(tx, {eventType,dedupeKey:`identity-proof:${record.id}`,userId:user.id,aggregateType:"IdentityToken",aggregateId:record.id,payload:{expiresAt:expiresAt.toISOString(),...(callbackUrl ? {callbackUrl:safeInternalDestination(callbackUrl,trustedAppUrl())} : {})},...(purpose === "EMAIL_CHANGE" ? {recipientEmail:targetEmail} : {}),secret:{id:record.id,token},secretExpiresAt:expiresAt});
}
export async function registerAccount(input: unknown) {
  const parsed = registrationInput.parse(input); const config = identityConfig();
  const passwordHash = await hash(parsed.password, 12);
  return identityTransaction(async tx => {
    await lockIdentity(tx, `email:${parsed.email}`);
    if (await tx.user.findUnique({where:{email:parsed.email}})) throw new AppError("Unable to create account with this email. Sign in or request password recovery.", 409);
    const orgName = parsed.orgName || `${parsed.name}'s workspace`;
    const user = await tx.user.create({data:{email:parsed.email,name:parsed.name,passwordHash,emailVerified:null,settings:{create:{theme:"system"}},memberships:{create:{role:"owner",org:{create:{name:orgName,slug:`${slugify(orgName)}-${randomBytes(8).toString("hex")}`,subscription:{create:{planId:"bizopt_pro_monthly",status:"pending_payment",currency:"usd",amountCents:999,trialPriceCents:99,trialDays:7,requiresPaymentMethod:true}},entitlement:{create:{active:false,userFacingState:"pending_payment",deviceLimit:1}}}}}}}});
    await issue(tx,user,"EMAIL_VERIFICATION",user.email,config.verificationMinutes,parsed.callbackUrl);
    return {ok:true, message:"Account created. Your verification email is queued. Delivery may take a few minutes."};
  });
}
async function requestProof(email: string, purpose: "EMAIL_VERIFICATION"|"PASSWORD_RESET", callbackUrl?: string) {
  const normalized = emailInput.parse(email); const config = identityConfig();
  await identityTransaction(async tx => {
    const found = await tx.user.findUnique({where:{email:normalized}});
    if (!found) return;
    await lockIdentity(tx,`user:${found.id}`);
    const user = await tx.user.findUnique({where:{id:found.id}});
    if (!user || user.email !== normalized || (purpose === "EMAIL_VERIFICATION" ? Boolean(user.emailVerified) : !user.passwordHash)) return;
    await issue(tx,user,purpose,normalized,purpose === "EMAIL_VERIFICATION" ? config.verificationMinutes : config.resetMinutes,callbackUrl);
  });
  return {ok:true,message:purpose === "EMAIL_VERIFICATION" ? VERIFICATION_MESSAGE : RESET_MESSAGE};
}
export async function requestVerification(email: string, callbackUrl?: string) { return requestProof(email,"EMAIL_VERIFICATION",callbackUrl); }
export async function requestPasswordReset(email: string, callbackUrl?: string) { return requestProof(email,"PASSWORD_RESET",callbackUrl); }
async function consume(tx: Prisma.TransactionClient, proof: IdentityProof, purpose: IdentityPurpose, currentUserId?: string) {
  // Lookup by hash prevents accepting legacy adapter tokens and binds the secret before acquiring a user lock.
  const found = await tx.identityToken.findUnique({where:{tokenHash:hashIdentityToken(proof.token)}});
  if (!found || (currentUserId && found.userId !== currentUserId)) throw invalidProof();
  await lockIdentity(tx,`user:${found.userId}`);
  const row = await tx.identityToken.findUnique({where:{tokenHash:hashIdentityToken(proof.token)}});
  const user = await tx.user.findUnique({where:{id:found.userId}}); const now = new Date();
  if (!row || !user || row.userId !== user.id || !validIdentityProof(row,proof,purpose,purpose === "EMAIL_CHANGE" ? row.targetEmail : user.email,now)) throw invalidProof();
  const claimed = await tx.identityToken.updateMany({where:{id:row.id,userId:user.id,tokenHash:row.tokenHash,purpose,targetEmail:row.targetEmail,consumedAt:null,expiresAt:{gt:now}},data:{consumedAt:now}});
  if (claimed.count !== 1) throw invalidProof();
  return {user,row,now};
}
export async function confirmVerification(input: unknown) {
  const proof = proofInput.parse(input); identityConfig();
  return identityTransaction(async tx => {
    const {user,now} = await consume(tx,proof,"EMAIL_VERIFICATION");
    if (user.emailVerified) throw invalidProof();
    const changed = await tx.user.updateMany({where:{id:user.id,email:user.email,emailVerified:null},data:{emailVerified:now}});
    if (changed.count !== 1) throw invalidProof();
    await tx.auditLog.create({data:{userId:user.id,action:"email.verified",entity:"User",entityId:user.id}});
    await emitEvent(tx,{eventType:"identity.verified",dedupeKey:`welcome:${user.id}`,userId:user.id,aggregateType:"User",aggregateId:user.id,payload:{verifiedAt:now.toISOString()}});
    return {ok:true,message:"Email verified. Sign in to continue."};
  });
}
async function revoke(tx: Prisma.TransactionClient, userId: string, now: Date) {
  await tx.webSession.updateMany({where:{userId,revokedAt:null},data:{revokedAt:now}});
  await tx.mobileSession.updateMany({where:{userId,revokedAt:null},data:{revokedAt:now}});
  await tx.supportAccessGrant.updateMany({where:{userId,revokedAt:null},data:{revokedAt:now}});
  await tx.session.deleteMany({where:{userId}});
  // Password/email changes cancel every outstanding proof, including pending email changes.
  await tx.identityToken.updateMany({where:{userId,consumedAt:null},data:{consumedAt:now}});
}
async function savePassword(tx: Prisma.TransactionClient, userId: string, passwordHash: string, now: Date) {
  await tx.user.update({where:{id:userId},data:{passwordHash,sessionVersion:{increment:1}}});
  await revoke(tx,userId,now);
  const audit = await tx.auditLog.create({data:{userId,action:"password.changed",entity:"User",entityId:userId,metadata:{changedAt:now.toISOString()}}});
  await emitEvent(tx,{eventType:"identity.password_changed",dedupeKey:`password-changed:${audit.id}`,userId,aggregateType:"AuditLog",aggregateId:audit.id,payload:{changedAt:now.toISOString()}});
}
export async function resetPassword(input: unknown) {
  const parsed = resetInput.parse(input); identityConfig();
  // Hash before the transaction; never send credentials to the outbox, audit log or error logger.
  const passwordHash = await hash(parsed.password,12);
  return identityTransaction(async tx => {
    const {user,now} = await consume(tx,parsed,"PASSWORD_RESET");
    if (!user.passwordHash) throw invalidProof();
    await savePassword(tx,user.id,passwordHash,now);
    return {ok:true,message:"Password changed. Sign in with your new password."};
  });
}
async function requireCurrentPassword(tx: Prisma.TransactionClient, userId: string, password: string) {
  const user = await tx.user.findUnique({where:{id:userId}});
  if (!user) throw new AppError("Unauthorized",401);
  if (!user.emailVerified) throw new AppError("Verify your email before changing account security settings.",403);
  if (!user.passwordHash) throw new AppError("Use your sign-in provider to manage account credentials.",403);
  if (!await compare(password,user.passwordHash)) throw new AppError("Please confirm your current password.",403);
  return user;
}
export async function changePassword(userId: string, input: unknown) {
  const parsed = changePasswordInput.parse(input); identityConfig(); const passwordHash = await hash(parsed.password,12);
  return identityTransaction(async tx => {
    await lockIdentity(tx,`user:${userId}`); await requireCurrentPassword(tx,userId,parsed.currentPassword);
    await savePassword(tx,userId,passwordHash,new Date());
    return {ok:true,message:"Password changed. Sign in again with your new password."};
  });
}
export async function requestEmailChange(userId: string, input: unknown) {
  const parsed = changeEmailInput.parse(input); const config = identityConfig();
  return identityTransaction(async tx => {
    await lockIdentity(tx,`user:${userId}`); const user = await requireCurrentPassword(tx,userId,parsed.currentPassword);
    if (user.email === parsed.email || await tx.user.findUnique({where:{email:parsed.email}})) throw new AppError("Unable to use this email address.",400);
    await issue(tx,user,"EMAIL_CHANGE",parsed.email,config.verificationMinutes);
    return {ok:true,message:"Confirmation for your new email address is queued. Your current email stays active until you confirm."};
  });
}
export async function confirmEmailChange(userId: string, input: unknown) {
  const proof = proofInput.parse(input); identityConfig();
  return identityTransaction(async tx => {
    const {user,row,now} = await consume(tx,proof,"EMAIL_CHANGE",userId);
    if (!user.emailVerified || !user.passwordHash) throw invalidProof();
    if (await tx.user.findUnique({where:{email:row.targetEmail}})) throw new AppError("Unable to use this email address. Request a new confirmation.",400);
    await tx.user.update({where:{id:userId},data:{email:row.targetEmail,emailVerified:now,sessionVersion:{increment:1}}});
    await revoke(tx,userId,now);
    const audit = await tx.auditLog.create({data:{userId,action:"email.changed",entity:"User",entityId:userId,metadata:{changedAt:now.toISOString()}}});
    await emitEvent(tx,{eventType:"identity.email_changed",dedupeKey:`email-changed:${audit.id}`,userId,aggregateType:"AuditLog",aggregateId:audit.id,recipientEmail:user.email,payload:{changedAt:now.toISOString()}});
    return {ok:true,message:"Email changed. Sign in again with your new email address."};
  });
}
