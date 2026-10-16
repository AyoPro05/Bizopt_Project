import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, emitEvent, preflight } = vi.hoisted(() => ({
 db: { $transaction: vi.fn(), $queryRaw: vi.fn(), user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, identityToken: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() }, auditLog: { create: vi.fn() }, webSession: { updateMany: vi.fn() }, mobileSession: { updateMany: vi.fn() }, supportAccessGrant: { updateMany: vi.fn() }, session: { deleteMany: vi.fn() }, entitlement: { update: vi.fn() } }, emitEvent: vi.fn(), preflight: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/services/automation/events", () => ({ emitEvent }));
vi.mock("@/services/notifications/config", () => ({ validateNotificationEncryption: preflight, trustedAppUrl: () => new URL("https://app.example.com") }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async (value: string) => `bcrypt:${value}`), compare: vi.fn(async (value: string, stored: string) => stored === `bcrypt:${value}`) }));
import { registerAccount, requestVerification, confirmVerification, requestPasswordReset, resetPassword, changePassword, requestEmailChange, confirmEmailChange } from "@/services/identity/lifecycle";
import { createIdentitySecret } from "@/services/identity/tokens";
const user = { id: "u", name: "Person <script>", email: "person@example.com", passwordHash: "bcrypt:current-password", emailVerified: null, sessionVersion: 0 };
let proof: {id: string; token: string};
let row: Record<string, unknown>;
describe("atomic identity lifecycle", () => {
 beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_URL","https://app.example.com"); vi.stubEnv("IDENTITY_VERIFICATION_TTL_MINUTES",""); vi.stubEnv("IDENTITY_RESET_TTL_MINUTES",""); const secret = createIdentitySecret(); proof = {id: "proof", token: secret.token}; row = { ...secret, id: "proof", userId: "u", purpose: "EMAIL_VERIFICATION", targetEmail: user.email, expiresAt: new Date(Date.now()+10000), consumedAt: null };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.user.findUnique.mockResolvedValue({...user}); db.user.create.mockResolvedValue({...user}); db.identityToken.findUnique.mockImplementation(async () => row);
  db.identityToken.create.mockImplementation(async ({data}) => ({id: "new-proof", ...data})); db.identityToken.updateMany.mockResolvedValue({count:1}); db.user.updateMany.mockResolvedValue({count:1});
  db.auditLog.create.mockResolvedValue({ id: "audit-id" });
 });
 it("creates unverified account, inactive entitlement and one encrypted-intent event in one transaction", async () => {
  db.user.findUnique.mockResolvedValue(null);
  await registerAccount({ name: user.name, email: user.email, password: "new-password" });
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({isolationLevel:"Serializable"}));
  const data = db.user.create.mock.calls[0][0].data;
  expect(data.emailVerified).toBeNull(); expect(data.memberships.create.org.create.entitlement.create.active).toBe(false);
  expect(emitEvent).toHaveBeenCalledOnce(); const event = emitEvent.mock.calls[0][1];
  expect(event.eventType).toBe("identity.verification_requested"); expect(event.secret.token).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(event.payload)).not.toContain(event.secret.token);
  expect(db.identityToken.create.mock.calls[0][0].data.tokenHash).not.toBe(event.secret.token);
 });
 it("preserves only safe internal signup destinations in verification links", async () => {
  db.user.findUnique.mockResolvedValue(null);
  await registerAccount({name:"Person",email:user.email,password:"new-password",callbackUrl:"/billing?plan=team"});
  expect(emitEvent.mock.calls[0][1].payload.callbackUrl).toBe("/billing?plan=team");
  await registerAccount({name:"Person",email:user.email,password:"new-password",callbackUrl:"https://attacker.example"});
  expect(emitEvent.mock.calls.at(-1)?.[1].payload.callbackUrl).toBe("/ai-studio");
 });
 it("preflights encrypted notification configuration before creating an account", async () => {
  preflight.mockImplementation(() => {throw new Error("Key missing");});
  await expect(registerAccount({name:"Person",email:user.email,password:"new-password"})).rejects.toThrow("Key missing");
  expect(db.user.create).not.toHaveBeenCalled();
 });
 it.each(["0","-1","1.5","1441","not-a-duration"])("fails closed for invalid verification expiration %s", async value => {
  vi.stubEnv("IDENTITY_VERIFICATION_TTL_MINUTES",value);
  await expect(registerAccount({name:"Person",email:user.email,password:"new-password"})).rejects.toThrow("bounded positive integer");
  expect(db.user.create).not.toHaveBeenCalled();
 });
 it("requires APP_URL even when another auth URL is present", async () => {
  vi.stubEnv("APP_URL","");vi.stubEnv("NEXTAUTH_URL","https://auth.example.com");
  await expect(registerAccount({name:"Person",email:user.email,password:"new-password"})).rejects.toThrow("APP_URL");
  expect(db.user.create).not.toHaveBeenCalled();
 });
 it("invalidates obsolete verification proofs on resend", async () => {
  await requestVerification(user.email);
  expect(db.identityToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{userId:"u",purpose:"EMAIL_VERIFICATION",consumedAt:null}, data:{consumedAt:expect.any(Date)}}));
  expect(emitEvent).toHaveBeenCalledOnce();
 });
 it("verifies using CAS, schedules welcome once and never changes entitlements", async () => {
  await confirmVerification(proof);
  expect(db.identityToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"proof",userId:"u",consumedAt:null,tokenHash:row.tokenHash,purpose:"EMAIL_VERIFICATION",targetEmail:user.email,expiresAt:{gt:expect.any(Date)}})}));
  expect(db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{emailVerified:expect.any(Date)}}));
  expect(emitEvent.mock.calls[0][1]).toEqual(expect.objectContaining({eventType:"identity.verified",dedupeKey:"welcome:u"}));
  expect(db.entitlement.update).not.toHaveBeenCalled();
 });
 it("only one concurrent confirmation succeeds when consume loses CAS", async () => {
  db.identityToken.updateMany.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});
  const results = await Promise.allSettled([confirmVerification(proof),confirmVerification(proof)]);
  expect(results.filter(r=>r.status === "fulfilled")).toHaveLength(1); expect(emitEvent).toHaveBeenCalledOnce();
 });
 it.each([{purpose:"PASSWORD_RESET"},{consumedAt:new Date()},{expiresAt:new Date(0)},{targetEmail:"changed@example.com"}])("rejects obsolete or incorrectly bound verification %o", async changed => {
  row = {...row,...changed}; await expect(confirmVerification(proof)).rejects.toThrow("invalid or expired"); expect(emitEvent).not.toHaveBeenCalled();
 });
 it("keeps eligible, nonexistent and OAuth-only recovery requests publicly identical", async () => {
  const eligible = await requestPasswordReset(user.email); expect(emitEvent).toHaveBeenCalledOnce();
  db.user.findUnique.mockResolvedValue(null); expect(await requestPasswordReset("missing@example.com")).toEqual(eligible);
  db.user.findUnique.mockResolvedValue({...user,passwordHash:null}); expect(await requestPasswordReset(user.email)).toEqual(eligible);
  expect(emitEvent).toHaveBeenCalledOnce();
 });
 it("atomically changes the password, consumes all proofs, revokes every session and emits one security event", async () => {
  row.purpose="PASSWORD_RESET";
  await resetPassword({...proof,password:"new-password",confirmPassword:"new-password"});
  expect(db.user.update).toHaveBeenCalledWith({where:{id:"u"},data:{passwordHash:"bcrypt:new-password",sessionVersion:{increment:1}}});
  for (const model of [db.webSession,db.mobileSession,db.supportAccessGrant]) expect(model.updateMany).toHaveBeenCalledWith({where:{userId:"u",revokedAt:null},data:{revokedAt:expect.any(Date)}});
  expect(db.session.deleteMany).toHaveBeenCalledWith({where:{userId:"u"}});
  expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:"password.changed"})}));
  expect(emitEvent.mock.calls[0][1]).toEqual(expect.objectContaining({eventType:"identity.password_changed",dedupeKey:"password-changed:audit-id"}));
  expect(JSON.stringify(emitEvent.mock.calls)).not.toContain("new-password");
 });
 it("rejects OAuth password creation and incorrect authenticated current passwords", async () => {
  db.user.findUnique.mockResolvedValue({...user,emailVerified:new Date(),passwordHash:null});
  await expect(changePassword("u",{currentPassword:"current-password",password:"new-password",confirmPassword:"new-password"})).rejects.toThrow("sign-in provider");
  db.user.findUnique.mockResolvedValue({...user,emailVerified:new Date()});
  await expect(changePassword("u",{currentPassword:"wrong",password:"new-password",confirmPassword:"new-password"})).rejects.toThrow("current password");
  expect(db.user.update).not.toHaveBeenCalled();
 });
 it("does not replace email until new-address confirmation and rejects a different authenticated user", async () => {
  db.user.findUnique.mockImplementation(async ({where})=>where.id?{...user,emailVerified:new Date()}:null);
  await requestEmailChange("u",{email:"new@example.com",currentPassword:"current-password"});
  expect(db.user.update).not.toHaveBeenCalled(); expect(emitEvent.mock.calls[0][1]).toEqual(expect.objectContaining({eventType:"identity.email_change_requested",recipientEmail:"new@example.com"}));
  row={...row,purpose:"EMAIL_CHANGE",targetEmail:"new@example.com"};
  await expect(confirmEmailChange("other",proof)).rejects.toThrow("invalid or expired");
  await confirmEmailChange("u",proof);
  expect(db.user.update).toHaveBeenCalledWith({where:{id:"u"},data:{email:"new@example.com",emailVerified:expect.any(Date),sessionVersion:{increment:1}}});
  expect(emitEvent.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({eventType:"identity.email_changed",recipientEmail:user.email}));
 });
});
