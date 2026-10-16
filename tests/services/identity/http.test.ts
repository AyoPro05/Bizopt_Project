// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db }=vi.hoisted(()=>({db:{$transaction:vi.fn(),$queryRaw:vi.fn(),identityRateLimit:{findUnique:vi.fn(),create:vi.fn(),update:vi.fn()},user:{update:vi.fn()},verificationToken:{findUnique:vi.fn()}}}));
vi.mock("@/lib/db",()=>({db}));
import { identityMutationGuard, privateIdentityHeaders } from "@/lib/identity-http";
import { consumeIdentityLimits, requestLimits, proofLimits } from "@/services/identity/request-policy";
import { GET as legacyVerification } from "@/app/api/auth/verify-email/route";
describe("identity HTTP boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("APP_URL","https://app.example.com");db.$transaction.mockImplementation((fn:(tx:typeof db)=>unknown)=>fn(db));db.identityRateLimit.findUnique.mockResolvedValue(null);});
 it("rejects cross-origin and missing-origin public proofs even with an arbitrary Authorization header",()=>{
  for(const origin of [null,"https://attacker.example"]){
   const headers:Record<string,string>={authorization:"Bearer arbitrary"};if(origin)headers.origin=origin;
   expect(()=>identityMutationGuard(new Request("https://app.example.com/api/auth/password-reset/confirm",{method:"POST",headers}))).toThrow("origin");
  }
  expect(()=>identityMutationGuard(new Request("https://app.example.com/api/auth/verification/confirm",{method:"POST",headers:{origin:"https://app.example.com"}}))).not.toThrow();
 });
 it("uses configured origin instead of attacker-controlled request Host",()=>{
  expect(()=>identityMutationGuard(new Request("https://attacker.example/api/auth/verification/confirm",{method:"POST",headers:{origin:"https://attacker.example"}}))).toThrow("origin");
 });
 it("persists hashed email and IP limits and applies the same limit to all accounts",async()=>{
  const rules=[{scope:"reset-email",value:"person@example.com",maximum:1,windowMs:60000},{scope:"reset-ip",value:"203.0.113.4",maximum:2,windowMs:60000}];
  expect((await consumeIdentityLimits(rules)).ok).toBe(true);
  const data=db.identityRateLimit.create.mock.calls.map(c=>c[0].data); expect(data).toHaveLength(2);
  expect(JSON.stringify(data)).not.toContain("person@example.com"); expect(JSON.stringify(data)).not.toContain("203.0.113.4");
  db.identityRateLimit.findUnique.mockResolvedValue({attempts:1,windowStartedAt:new Date()});
  expect((await consumeIdentityLimits(rules)).ok).toBe(false);
  expect(db.$queryRaw).toHaveBeenCalled();
 });
 it("stops creating arbitrary email/proof buckets after the IP budget is exhausted",async()=>{
  db.identityRateLimit.findUnique.mockResolvedValue({attempts:30,windowStartedAt:new Date()});
  expect((await requestLimits("reset","attacker-chosen@example.com","ip")).ok).toBe(false);
  expect(db.identityRateLimit.findUnique).toHaveBeenCalledTimes(1);
  db.identityRateLimit.findUnique.mockClear();
  await expect(proofLimits("reset","arbitrary-id","ip")).rejects.toThrow("Too many attempts");
  expect(db.identityRateLimit.findUnique).toHaveBeenCalledTimes(1);
 });
 it("resets expired durable windows",async()=>{
  db.identityRateLimit.findUnique.mockResolvedValue({attempts:999,windowStartedAt:new Date(0)});
  expect((await consumeIdentityLimits([{scope:"reset-ip",value:"ip",maximum:1,windowMs:60000}])).ok).toBe(true);
 });
 it("legacy verification GET neither reads/consumes old tokens nor forwards the query proof",async()=>{
  const response=await legacyVerification(new Request("https://app.example.com/api/auth/verify-email?token=raw-legacy-proof"));
  expect(response.status).toBe(303);expect(response.headers.get("location")).toBe("https://app.example.com/verify-email?legacy=1");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");expect(db.verificationToken.findUnique).not.toHaveBeenCalled();expect(db.user.update).not.toHaveBeenCalled();
  expect(JSON.stringify(Object.fromEntries(response.headers))).not.toContain("raw-legacy-proof");
 });
 it("proof responses prevent caching and referrer leaks",()=>{expect(privateIdentityHeaders["Referrer-Policy"]).toBe("no-referrer");expect(privateIdentityHeaders["Cache-Control"]).toContain("no-store");});
});
