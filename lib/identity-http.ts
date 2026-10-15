import { NextResponse } from "next/server";
import { clientIp } from "@/lib/rate-limit";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { AppError } from "@/services/platform/errors";
import { identityAppOrigin } from "@/services/identity/config";
import { confirmEmailChange, confirmVerification, requestPasswordReset, requestVerification, resetPassword, changePassword, requestEmailChange, registerAccount, RESET_MESSAGE, VERIFICATION_MESSAGE } from "@/services/identity/lifecycle";
import { emailRequestInput, proofInput } from "@/services/identity/schemas";
import { consumeIdentityLimits, proofLimits, publicResponseDelay, requestLimits } from "@/services/identity/request-policy";
export { identityAppOrigin } from "@/services/identity/config";
export const privateIdentityHeaders = {"Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", "X-Robots-Tag":"noindex, nofollow"};
export function identityMutationGuard(req: Request) {
  // Public proofs are never bearer-authenticated: an arbitrary header must not bypass CSRF checks.
  if (!req.headers.get("origin") || req.headers.get("origin") !== identityAppOrigin()) throw new AppError("Request origin is not allowed.",403);
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new AppError("Request origin is not allowed.",403);
}
export function identityJson(body: unknown,status=200,extra:Record<string,string>={}) { return NextResponse.json(body,{status,headers:{...privateIdentityHeaders,...extra}}); }
export function identityError(error:unknown) {
  const response = platformError(error); Object.entries(privateIdentityHeaders).forEach(([key,value])=>response.headers.set(key,value)); return response;
}

export async function handleSignup(req: Request) {
  try {
    identityMutationGuard(req);
    const limited = await consumeIdentityLimits([{scope:"signup:ip",value:clientIp(req),maximum:5,windowMs:3600000}]);
    if(!limited.ok) return identityJson({error:"Too many signup attempts. Try again later."},429,{"Retry-After":String(limited.retryAfterSec)});
    return identityJson(await registerAccount(await readJson(req,4096)),201);
  } catch(error) { return identityError(error); }
}
export async function handlePublicRequest(req:Request,kind:"verification"|"password-reset") {
  const started = performance.now();
  try {
    identityMutationGuard(req);
    const {email,callbackUrl} = emailRequestInput.parse(await readJson(req,1024));
    const allowed = await requestLimits(kind,email,clientIp(req));
    if(allowed.ok) {
      if(kind === "verification") await requestVerification(email,callbackUrl); else await requestPasswordReset(email,callbackUrl);
    }
    await publicResponseDelay(started);
    // Headers, status, wording and delay are identical for missing/ineligible/cooled-down addresses.
    return identityJson({ok:true,message:kind === "verification" ? VERIFICATION_MESSAGE : RESET_MESSAGE},202,{"Retry-After":"60"});
  } catch(error) { await publicResponseDelay(started); return identityError(error); }
}
export async function handlePublicConfirmation(req:Request,kind:"verification"|"password-reset") {
  try {
    identityMutationGuard(req);
    const input = await readJson(req,4096);
    const {id} = proofInput.pick({id:true}).passthrough().parse(input);
    await proofLimits(`${kind}:confirm`,id,clientIp(req));
    return identityJson(kind === "verification" ? await confirmVerification(input) : await resetPassword(input));
  } catch(error) { return identityError(error); }
}
export async function handleAccountSecurity(req:Request,kind:"password"|"email-request"|"email-confirm") {
  try {
    identityMutationGuard(req); mutationGuard(req);
    const ctx = await getPlatformContext(req);
    if(!ctx.user.emailVerified) throw new AppError("Verify your email before changing account security settings.",403);
    const limited = await consumeIdentityLimits([{scope:"account-security:user",value:ctx.userId,maximum:5,windowMs:900000},{scope:"account-security:ip",value:clientIp(req),maximum:30,windowMs:3600000}]);
    if(!limited.ok) return identityJson({error:"Too many account security attempts. Please wait before trying again."},429,{"Retry-After":String(limited.retryAfterSec)});
    const input = await readJson(req,4096);
    if(kind === "email-confirm") return identityJson(await confirmEmailChange(ctx.userId,input));
    if(kind === "email-request") return identityJson(await requestEmailChange(ctx.userId,input),202);
    return identityJson(await changePassword(ctx.userId,input));
  } catch(error) { return identityError(error); }
}
