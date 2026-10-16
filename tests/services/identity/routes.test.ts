// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { service, rate, context }=vi.hoisted(()=>({service:{requestPasswordReset:vi.fn(),requestVerification:vi.fn(),resetPassword:vi.fn(),confirmVerification:vi.fn(),changePassword:vi.fn(),requestEmailChange:vi.fn(),confirmEmailChange:vi.fn(),registerAccount:vi.fn()},rate:vi.fn(),context:vi.fn()}));
vi.mock("@/services/identity/lifecycle",()=>({...service,RESET_MESSAGE:"If an eligible account exists, we’ll send password reset instructions.",VERIFICATION_MESSAGE:"If an eligible account exists, we’ll queue a verification email. Please check your inbox and spam folder."}));
vi.mock("@/services/identity/database",()=>({identityTransaction:async(fn:unknown)=>fn,lockIdentity:vi.fn()}));
vi.mock("@/services/identity/request-policy",()=>({requestLimits:rate,proofLimits:vi.fn(),consumeIdentityLimits:rate,publicResponseDelay:vi.fn()}));
vi.mock("@/lib/platform-context",()=>({getPlatformContext:context}));
import { POST as resetRequest } from "@/app/api/auth/password-reset/request/route";
import { POST as passwordChange } from "@/app/api/account/password/route";
function post(url:string,data:unknown,headers:Record<string,string>={}){return new Request(`https://app.example.com${url}`,{method:"POST",headers:{"content-type":"application/json",origin:"https://app.example.com",...headers},body:JSON.stringify(data)});}
describe("identity route contracts",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("APP_URL","https://app.example.com");rate.mockResolvedValue({ok:true});context.mockResolvedValue({userId:"u",user:{emailVerified:new Date()}});});
 it("returns exactly the same reset acknowledgment and status for eligible, nonexistent and rate-limited accounts",async()=>{
  const first=await resetRequest(post("/api/auth/password-reset/request",{email:"eligible@example.com"}));
  const second=await resetRequest(post("/api/auth/password-reset/request",{email:"missing@example.com"}));
  rate.mockResolvedValue({ok:false,retryAfterSec:3600});const limited=await resetRequest(post("/api/auth/password-reset/request",{email:"eligible@example.com"}));
  expect(first.status).toBe(202);expect(second.status).toBe(202);expect(limited.status).toBe(202);
  const expected={ok:true,message:"If an eligible account exists, we’ll send password reset instructions."};
  expect(await first.json()).toEqual(expected);expect(await second.json()).toEqual(expected);expect(await limited.json()).toEqual(expected);
  expect(service.requestPasswordReset).toHaveBeenCalledTimes(2);expect(first.headers.get("retry-after")).toBe(limited.headers.get("retry-after"));
 });
 it("requires current authenticated user, same origin and verified identity for password changes",async()=>{
  const body={currentPassword:"current-password",password:"new-password",confirmPassword:"new-password"};
  expect((await passwordChange(post("/api/account/password",body,{origin:"https://attacker.example",authorization:"Bearer made-up"}))).status).toBe(403);
  expect(service.changePassword).not.toHaveBeenCalled();
  context.mockResolvedValue({userId:"u",user:{emailVerified:null}});
  expect((await passwordChange(post("/api/account/password",body))).status).toBe(403);
  context.mockResolvedValue({userId:"u",user:{emailVerified:new Date()}});
  await passwordChange(post("/api/account/password",body));expect(service.changePassword).toHaveBeenCalledWith("u",body);
 });
 it("rejects an oversized body before passing passwords to domain code",async()=>{
  const result=await passwordChange(post("/api/account/password",{currentPassword:"x".repeat(6000),password:"new-password",confirmPassword:"new-password"}));
  expect(result.status).toBe(413);expect(service.changePassword).not.toHaveBeenCalled();
 });
});
